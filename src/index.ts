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

// interface ExampleInputs {
//   collaborators: '[{"login":"pavlovcik","id":4975670,"node_id":"MDQ6VXNlcjQ5NzU2NzA=","avatar_url":"https://avatars.githubusercontent.com/u/4975670?v=4","gravatar_id":"","url":"https://api.github.com/users/pavlovcik","html_url":"https://github.com/pavlovcik","followers_url":"https://api.github.com/users/pavlovcik/followers","following_url":"https://api.github.com/users/pavlovcik/following{/other_user}","gists_url":"https://api.github.com/users/pavlovcik/gists{/gist_id}","starred_url":"https://api.github.com/users/pavlovcik/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/pavlovcik/subscriptions","organizations_url":"https://api.github.com/users/pavlovcik/orgs","repos_url":"https://api.github.com/users/pavlovcik/repos","events_url":"https://api.github.com/users/pavlovcik/events{/privacy}","received_events_url":"https://api.github.com/users/pavlovcik/received_events","type":"User","site_admin":false,"permissions":{"admin":true,"maintain":true,"push":true,"triage":true,"pull":true},"role_name":"admin"}]';
//   eventName: "issues.closed";
//   issueNumber: "25";
//   issueOwner: "pavlovcik";
//   issueRepository: "ubiquibot-sandbox";
// }

async function run() {
  const { SUPABASE_URL, SUPABASE_KEY, openAi } = checkEnvironmentVariables();
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const webhookPayload = github.context.payload;
  const inputs = webhookPayload.inputs as DelegatedComputeInputs; //as ExampleInputs;

  console.trace({ inputs });

  const eventName = inputs.eventName;
  if (GitHubEvent.ISSUES_CLOSED === eventName) {
    return await issueClosedEventHandler(supabaseClient, openAi, inputs);
  } else {
    throw new Error(`Event ${eventName} is not supported`);
  }
}

async function issueClosedEventHandler(supabaseClient: SupabaseClient, openAi: OpenAI, inputs: DelegatedComputeInputs) {
  const issueNumber = Number(inputs.issueNumber);
  const issue = await getIssue(inputs.issueOwner, inputs.issueRepository, issueNumber);
  const issueComments = await getIssueComments(inputs.issueOwner, inputs.issueRepository, issueNumber);
  const pullRequestComments = await getPullRequestComments(inputs.issueOwner, inputs.issueRepository, issueNumber);

  const config = await getConfig(inputs.issueOwner, inputs.issueRepository);

  const  collaboratorsParsed = JSON.parse(inputs.collaborators);

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

async function getConfig(owner: string, repository: string): Promise<BotConfig> {
  return generateConfiguration(owner, repository);
}
