import * as core from "@actions/core";
import * as github from "@actions/github";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import zlib from "zlib";
import { checkEnvironmentVariables } from "./check-env";
import { issueClosed } from "./handlers/issue/issue-closed";
import { BotConfig, GitHubComment, GitHubEvent, GitHubIssue, GitHubUser } from "./types/payload";

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
  issueNumber: number;
}

async function run() {
  const { SUPABASE_URL, SUPABASE_KEY } = checkEnvironmentVariables();
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const webhookPayload = github.context.payload;
  const inputs = JSON.parse(webhookPayload.inputs) as DelegatedComputeInputs;
  const eventName = inputs.eventName;
  if (GitHubEvent.ISSUES_CLOSED === eventName) {
    return await issueClosedEventHandler(supabaseClient, inputs);
  } else {
    throw new Error(`Event ${eventName} is not supported`);
  }
}

async function issueClosedEventHandler(supabaseClient: SupabaseClient, inputs: DelegatedComputeInputs) {
  const issue = await getIssue(inputs.issueOwner, inputs.issueRepository, inputs.issueNumber);
  const issueComments = await getIssueComments(issue);
  const pullRequestComments = await getPullRequestComments(issue);
  const repoCollaborators = await getRepoCollaborators(issue);

  const openAi = getOpenAi();
  const config = await getConfig(inputs.issueOwner, inputs.issueRepository);

  const result: string = await issueClosed({
    issue,
    issueComments,
    pullRequestComments,
    repoCollaborators,
    openAi,
    config,
    supabase: supabaseClient,
  });
  const compressedString = zlib.gzipSync(Buffer.from(result.replace(/<!--[\s\S]*?-->/g, "")));

  return compressedString.toJSON();
}

// TODO: finish implementing these functions
async function getIssue(owner: string, repository: string, issueNumber: number): Promise<GitHubIssue> {}
async function getIssueComments(issue: GitHubIssue): Promise<GitHubComment[]> {}
async function getPullRequestComments(issue: GitHubIssue): Promise<GitHubComment[]> {}
async function getRepoCollaborators(issue: GitHubIssue): Promise<GitHubUser[]> {}
function getOpenAi(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
async function getConfig(owner: string, repository: string): Promise<BotConfig> {
  // TODO: fetch config from source repository.
  // Ensure that its organization config is also fetched and merged properly as we do normally during bot startup.
}
