import * as core from "@actions/core";
import * as github from "@actions/github";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import zlib from "zlib";
import { checkEnvironmentVariables } from "./check-env";
import { issueClosed } from "./handlers/issue/issue-closed";
import { BotConfig, GitHubComment, GitHubEvent, GitHubIssue, GitHubUser } from "./types/payload";
import { getLinkedPullRequests } from "./helpers/get-linked-issues-and-pull-requests";
import { generateConfiguration } from "./utils/generate-configuration";

export const octokit: Octokit = new Octokit({});

run()
  .then((result) => core.setOutput("result", result))
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });

interface DelegatedComputeInputs {
  eventName: GitHubEvent;
  organization: string;
  issueOwner: string;
  issueRepository: string;
  issueNumber: string;
  repoCollaborators: string;
}

async function run() {
  const { SUPABASE_URL, SUPABASE_KEY } = checkEnvironmentVariables();
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const webhookPayload = github.context.payload;
  const inputs = webhookPayload.inputs as DelegatedComputeInputs;
  console.log("~~~~~~~~~~~~~~~~~~~", inputs);
  const eventName = inputs.eventName;
  if (GitHubEvent.ISSUES_CLOSED === eventName) {
    return await issueClosedEventHandler(supabaseClient, inputs);
  } else {
    throw new Error(`Event ${eventName} is not supported`);
  }
}

async function issueClosedEventHandler(supabaseClient: SupabaseClient, inputs: DelegatedComputeInputs) {
  const issueNumber = Number(inputs.issueNumber);
  const issue = await getIssue(inputs.issueOwner, inputs.issueRepository, issueNumber);
  const issueComments = await getIssueComments(inputs.issueOwner, inputs.issueRepository, issueNumber);
  const pullRequestComments = await getPullRequestComments(inputs.issueOwner, inputs.issueRepository, issueNumber);

  const openAi = getOpenAi();
  const config = await getConfig(inputs.organization, inputs.issueOwner, inputs.issueRepository);

  console.log(issue, "----");
  console.log(issueComments, "----");
  console.log(pullRequestComments, "----");
  console.log(config, "----");

  const result: string = await issueClosed({
    issue,
    issueComments,
    pullRequestComments,
    repoCollaborators: JSON.parse(inputs.repoCollaborators),
    openAi,
    config,
    supabase: supabaseClient,
  });
  const compressedString = zlib.gzipSync(Buffer.from(result.replace(/<!--[\s\S]*?-->/g, "")));

  return compressedString.toJSON();
}

// TODO: finish implementing these functions
async function getIssue(owner: string, repository: string, issueNumber: number): Promise<GitHubIssue> {
  try {
    const { data: issue } = await octokit.rest.issues.get({
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
  owner: string,
  repository: string,
  issueNumber: number,
  format: "raw" | "html" | "text" | "full" = "raw"
): Promise<GitHubComment[]> {
  try {
    const comments = (await octokit.paginate(octokit.rest.issues.listComments, {
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
  owner: string,
  repository: string,
  issueNumber: number
): Promise<GitHubComment[]> {
  const pullRequestComments: GitHubComment[] = [];
  const linkedPullRequests = await getLinkedPullRequests({ owner, repository, issue: issueNumber });
  if (linkedPullRequests.length) {
    const linkedCommentsPromises = linkedPullRequests.map((pull) => getIssueComments(owner, repository, pull.number));
    const linkedCommentsResolved = await Promise.all(linkedCommentsPromises);
    for (const linkedComments of linkedCommentsResolved) {
      pullRequestComments.push(...linkedComments);
    }
  }
  return pullRequestComments;
}

async function getRepoCollaborators(owner: string, repository: string): Promise<GitHubUser[]> {
  try {
    const collaboratorUsers = (await octokit.paginate(octokit.rest.repos.listCollaborators, {
      owner,
      repo: repository,
      per_page: 100,
    })) as GitHubUser[];
    return collaboratorUsers;
  } catch (err: unknown) {
    throw new Error("Failed to fetch lists of collaborators");
  }
}
function getOpenAi(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
async function getConfig(organization: string, owner: string, repository: string): Promise<BotConfig> {
  return generateConfiguration(organization, owner, repository);
}
