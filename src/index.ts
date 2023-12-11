import * as core from "@actions/core";
import * as github from "@actions/github";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import zlib from "zlib";
import { checkEnvironmentVariables } from "./check-env";
import { issueClosed } from "./handlers/issue/issue-closed";
import { GitHubComment, GitHubIssue, GitHubUser, IssueClosedEventPayload } from "./types/payload";

run()
  .then((result) => core.setOutput("result", result))
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });

async function run() {
  const { SUPABASE_URL, SUPABASE_KEY } = checkEnvironmentVariables();
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const webhookPayload = github.context.payload;
  const eventName = webhookPayload.inputs.eventName;
  const handlerPayload = JSON.parse(webhookPayload.inputs.payload);
  if (eventName === "issueClosed") {
    return await issueClosedEventHandler(supabaseClient, handlerPayload);
  } else {
    throw new Error(`Event ${eventName} is not supported`);
  }
}

async function issueClosedEventHandler(supabaseClient: SupabaseClient, payload: IssueClosedEventPayload) {


  const result: string = await issueClosed({
    issue,
    issueComments,
    pullRequestComments,
    repoCollaborators,
    openAi: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    config: payload.botConfig,
    supabase: supabaseClient,
  });
  const compressedString = zlib.gzipSync(Buffer.from(result.replace(/<!--[\s\S]*?-->/g, "")));

  return compressedString.toJSON();
}

async function getIssue(owner: string, repository: string, issueNumber: number): Promise<GitHubIssue> {}
async function getIssueComments(issue: GitHubIssue): Promise<GitHubComment[]> {}
async function getPullRequestComments(issue: GitHubIssue): Promise<GitHubComment[]> {}
async function getRepoCollaborators(issue: GitHubIssue): Promise<GitHubUser[]> {}
