import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { getEnvironmentVariables } from "./check-env";
import { issueClosed } from "./handlers/issue/issue-closed";
import { getLinkedPullRequests } from "./helpers/get-linked-issues-and-pull-requests";
import { GitHubComment, GitHubEvent, GitHubIssue, GitHubUser } from "./types/payload";
import { EmitterWebhookEvent as GithubWebhookEvent } from "@octokit/webhooks";

run()
  .then((result) => core.setOutput("result", result))
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });

type SupportedEvents = "issues.closed";

export interface DelegatedComputeInputs {
  eventName: SupportedEvents;
  event: GithubWebhookEvent<SupportedEvents>;
  settings: PluginSettings;
  authToken: string;
}

export interface PluginSettings {
  evmNetworkId: number;
  isNftRewardEnabled: boolean;
  evmPrivateEncrypted: string;
}

async function run() {
  const { SUPABASE_URL, SUPABASE_KEY, openAi } = getEnvironmentVariables();
  const webhookPayload = github.context.payload.inputs;
  console.log({
    eventName: webhookPayload.eventName,
    event: webhookPayload.event,
    settings: webhookPayload.settings,
    authToken: webhookPayload.authToken ? "REDACTED" : "undefined",
  });
  const inputs: DelegatedComputeInputs = {
    eventName: webhookPayload.eventName,
    event: JSON.parse(webhookPayload.event),
    settings: JSON.parse(webhookPayload.settings),
    authToken: webhookPayload.authToken,
  };
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const octokit = new Octokit({ auth: inputs.authToken });

  const eventName = inputs.eventName;
  let result: string;

  if (GitHubEvent.ISSUES_CLOSED === eventName) {
    result = await issueClosedEventHandler(supabaseClient, openAi, octokit, inputs);
  } else {
    throw new Error(`Event ${eventName} is not supported`);
  }

  await octokit.rest.issues.createComment({
    owner: inputs.event.payload.repository.owner.login,
    repo: inputs.event.payload.repository.name,
    issue_number: inputs.event.payload.issue.number,
    body: result,
  });

  return result;
}

export async function issueClosedEventHandler(
  supabaseClient: SupabaseClient,
  openAi: OpenAI,
  authenticatedOctokit: Octokit,
  inputs: DelegatedComputeInputs
) {
  const owner = inputs.event.payload.repository.owner.login;
  const repository = inputs.event.payload.repository.name;
  const issueNumber = Number(inputs.event.payload.issue.number);
  const issue = await getIssue(authenticatedOctokit, owner, inputs.event.payload.repository.name, issueNumber);
  const issueComments = await getIssueComments(authenticatedOctokit, owner, repository, issueNumber);
  const pullRequestComments = await getPullRequestComments(authenticatedOctokit, owner, repository, issueNumber);

  const collaborators = await getCollaboratorsForRepo(authenticatedOctokit, owner, repository);
  const collaboratorUsers = await Promise.all(
    collaborators.map(async (collaborator) => getUser(authenticatedOctokit, collaborator.login))
  );

  const result: string = await issueClosed({
    issue,
    issueComments,
    pullRequestComments,
    collaborators: collaboratorUsers,
    openAi,
    settings: inputs.settings,
    supabase: supabaseClient,
  });

  return result;

  // const clipped = result.replace(/<!--[\s\S]*?-->/g, "");
  // return clipped;
}

async function getCollaboratorsForRepo(authenticatedOctokit: Octokit, owner: string, repository: string) {
  try {
    const collaboratorUsers = await authenticatedOctokit.paginate(authenticatedOctokit.rest.repos.listCollaborators, {
      owner,
      repo: repository,
      per_page: 100,
    });
    return collaboratorUsers;
  } catch (err: unknown) {
    console.error("Failed to fetch lists of collaborators", err);
    return [];
  }
}

async function getUser(authenticatedOctokit: Octokit, username: string): Promise<GitHubUser> {
  try {
    const { data: user } = await authenticatedOctokit.rest.users.getByUsername({
      username: username,
    });
    return user as GitHubUser;
  } catch (e: unknown) {
    throw new Error(`fetching user failed! ${e}`);
  }
}

async function getIssue(
  authenticatedOctokit: Octokit,
  owner: string,
  repository: string,
  issueNumber: number
): Promise<GitHubIssue> {
  try {
    const { data: issue } = await authenticatedOctokit.rest.issues.get({
      owner: owner,
      repo: repository,
      issue_number: issueNumber,
    });
    return issue as GitHubIssue;
  } catch (e: unknown) {
    throw new Error(`fetching issue failed! ${e}`);
  }
}

async function getIssueComments(
  authenticatedOctokit: Octokit,
  owner: string,
  repository: string,
  issueNumber: number,
  format: "raw" | "html" | "text" | "full" = "raw"
): Promise<GitHubComment[]> {
  try {
    const comments = (await authenticatedOctokit.paginate(authenticatedOctokit.rest.issues.listComments, {
      owner,
      repo: repository,
      issue_number: issueNumber,
      per_page: 100,
      mediaType: {
        format,
      },
    })) as GitHubComment[];
    return comments;
  } catch (e: unknown) {
    throw new Error(`Fetching all issue comments failed! ${e}`);
  }
}
async function getPullRequestComments(
  authenticatedOctokit: Octokit,
  owner: string,
  repository: string,
  issueNumber: number
): Promise<GitHubComment[]> {
  const pullRequestComments: GitHubComment[] = [];
  const linkedPullRequests = await getLinkedPullRequests({ owner, repository, issue: issueNumber });
  if (linkedPullRequests.length) {
    const linkedCommentsPromises = linkedPullRequests.map((pull) =>
      getIssueComments(authenticatedOctokit, owner, repository, pull.number)
    );
    const linkedCommentsResolved = await Promise.all(linkedCommentsPromises);
    for (const linkedComments of linkedCommentsResolved) {
      pullRequestComments.push(...linkedComments);
    }
  }
  return pullRequestComments;
}
