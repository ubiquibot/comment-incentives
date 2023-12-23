import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { checkEnvironmentVariables } from "./check-env";
import { issueClosed } from "./handlers/issue/issue-closed";
import { getLinkedPullRequests } from "./helpers/get-linked-issues-and-pull-requests";
import { BotConfig, GitHubComment, GitHubEvent, GitHubIssue, GitHubUser } from "./types/payload";
import { generateConfiguration } from "./utils/generate-configuration";
import { generateInstallationAccessToken } from "./utils/generate-access-token";

export const octokit: Octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

run()
  .then((result) => core.setOutput("result", result))
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });

interface DelegatedComputeInputs {
  eventName: GitHubEvent;
  issueOwner: string;
  issueRepository: string;
  issueNumber: string;
  collaborators: string;
}

const { SUPABASE_URL, SUPABASE_KEY, openAi, appId, privateKey, installationId } = checkEnvironmentVariables();

async function run() {
  const originRepositoryAuthenticationToken = await generateInstallationAccessToken(appId, privateKey, installationId);
  const authenticatedOctokit = new Octokit({ auth: originRepositoryAuthenticationToken });
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const webhookPayload = github.context.payload;
  const inputs = webhookPayload.inputs as DelegatedComputeInputs; //as ExampleInputs;

  console.trace({ inputs });

  const eventName = inputs.eventName;
  if (GitHubEvent.ISSUES_CLOSED === eventName) {
    return await issueClosedEventHandler(supabaseClient, openAi, authenticatedOctokit, inputs);
  } else {
    throw new Error(`Event ${eventName} is not supported`);
  }
}

async function issueClosedEventHandler(
  supabaseClient: SupabaseClient,
  openAi: OpenAI,
  authenticatedOctokit: Octokit,
  inputs: DelegatedComputeInputs
) {
  const issueNumber = Number(inputs.issueNumber);
  const issue = await getIssue(authenticatedOctokit, inputs.issueOwner, inputs.issueRepository, issueNumber);
  const issueComments = await getIssueComments(authenticatedOctokit, inputs.issueOwner, inputs.issueRepository, issueNumber);
  const pullRequestComments = await getPullRequestComments(
    authenticatedOctokit,
    inputs.issueOwner,
    inputs.issueRepository,
    issueNumber
  );

  const config = await getConfig(authenticatedOctokit, inputs.issueOwner, inputs.issueRepository);

  const collaboratorsParsed = JSON.parse(inputs.collaborators);

  const collaborators = await Promise.all(collaboratorsParsed.map((login: GitHubUser["login"]) => getUser(login)));

  const result: string = await issueClosed({
    issue,
    issueComments,
    pullRequestComments,
    collaborators,
    openAi,
    config,
    supabase: supabaseClient,
  });

  return result;

  // const clipped = result.replace(/<!--[\s\S]*?-->/g, "");
  // return clipped;
}

async function getUser(username: string): Promise<GitHubUser> {
  try {
    const { data: user } = await octokit.rest.users.getByUsername({
      username: username,
    });
    return user as GitHubUser;
  } catch (e: unknown) {
    throw new Error("fetching user failed!");
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
    throw new Error("fetching issue failed!");
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
    const comments = (await authenticatedOctokit.paginate(octokit.rest.issues.listComments, {
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
    throw new Error("Fetching all issue comments failed!");
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

async function getConfig(authenticatedOctokit: Octokit, owner: string, repository: string): Promise<BotConfig> {
  return generateConfiguration(authenticatedOctokit, owner, repository);
}
