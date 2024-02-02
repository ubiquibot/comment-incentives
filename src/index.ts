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
import { generateConfiguration } from "./utils/generate-configuration";
import { BotConfig } from "./types/configuration-types";

async function getAuthenticatedOctokit() {
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

  return await octokit.rest.issues.createComment({
    owner: inputs.issueOwner,
    repo: inputs.issueRepository,
    issue_number: Number(inputs.issueNumber),
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

interface DelegatedComputeInputs {
  eventName: GitHubEvent;
  issueOwner: string;
  issueRepository: string;
  issueNumber: string;
  collaborators: string;
  installationId: string;
}

async function run(authenticatedOctokit: Octokit) {
  const { SUPABASE_URL, SUPABASE_KEY, openAi } = checkEnvironmentVariables();
  const webhookPayload = github.context.payload;
  const inputs = webhookPayload.inputs as DelegatedComputeInputs; //as ExampleInputs;
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  const issueComments = await getIssueComments(
    authenticatedOctokit,
    inputs.issueOwner,
    inputs.issueRepository,
    issueNumber
  );
  const pullRequestComments = await getPullRequestComments(
    authenticatedOctokit,
    inputs.issueOwner,
    inputs.issueRepository,
    issueNumber
  );

  const config = await getConfig(authenticatedOctokit, inputs.issueOwner, inputs.issueRepository);

  const collaboratorsParsed = JSON.parse(inputs.collaborators);

  const collaborators = await Promise.all(
    collaboratorsParsed.map((login: GitHubUser["login"]) => getUser(authenticatedOctokit, login))
  );

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

async function getUser(authenticatedOctokit: Octokit, username: string): Promise<GitHubUser> {
  try {
    const { data: user } = await authenticatedOctokit.rest.users.getByUsername({
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
  const linkedPullRequests = await getLinkedPullRequests({ authenticatedOctokit, owner, repository, issue: issueNumber });
  console.trace("Linked pull requests: ", linkedPullRequests);
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
