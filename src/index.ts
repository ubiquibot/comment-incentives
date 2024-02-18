import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { checkEnvironmentVariables } from "./check-env";
import { issueClosed } from "./handlers/issue/issue-closed";
import { getLinkedPullRequests } from "./helpers/get-linked-issues-and-pull-requests";
import { GitHubComment, GitHubEvent, GitHubIssue, GitHubUser } from "./types/payload";
import { generateInstallationAccessToken } from "./utils/generate-access-token";
import { EmitterWebhookEvent as GithubWebhookEvent } from "@octokit/webhooks";

export async function getAuthenticatedOctokit(): Promise<Octokit> {
  const { appId, privateKey } = checkEnvironmentVariables();
  const webhookPayload = github.context.payload;
  const inputs = webhookPayload.inputs as DelegatedComputeInputs; //as ExampleInputs;
  const originRepositoryAuthenticationToken = await generateInstallationAccessToken(
    appId,
    privateKey,
    inputs.installationId
  );
  const authenticatedOctokit = new Octokit({ auth: originRepositoryAuthenticationToken });
  return authenticatedOctokit;
}

async function postAuthenticatedRunResult(result: string) {
  const octokit = await getAuthenticatedOctokit();
  const inputs = github.context.payload.inputs as DelegatedComputeInputs;

  const owner = inputs.event.payload.repository.owner.login;
  const repository = inputs.event.payload.repository.name;
  const issueNumber = Number(inputs.event.payload.issue.number);
  return await octokit.rest.issues.createComment({
    owner,
    repo: repository,
    issue_number: issueNumber,
    body: result,
  });
}

getAuthenticatedOctokit()
  .then(run)
  .then(postAuthenticatedRunResult)
  .then((result) => core.setOutput("result", result))
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });

export interface DelegatedComputeInputs {
  eventName: "issues.closed";
  event: GithubWebhookEvent<"issues.closed">;
  settings: PluginSettings;
  installationId: string;
}

export interface PluginSettings {
  evmNetworkId: number;
  isNftRewardEnabled: boolean;
  evmPrivateEncrypted: string;
}

async function run(authenticatedOctokit: Octokit) {
  const { SUPABASE_URL, SUPABASE_KEY, openAi } = checkEnvironmentVariables();
  const webhookPayload = github.context.payload;
  const inputs: DelegatedComputeInputs = {
    eventName: webhookPayload.eventName,
    event: JSON.parse(webhookPayload.event),
    settings: JSON.parse(webhookPayload.settings),
    installationId: webhookPayload.installationId,
  };
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

  const eventName = inputs.eventName;
  if (GitHubEvent.ISSUES_CLOSED === eventName) {
    return await issueClosedEventHandler(supabaseClient, openAi, authenticatedOctokit, inputs);
  } else {
    throw new Error(`Event ${eventName} is not supported`);
  }
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
