import { createClient } from "@supabase/supabase-js";
import { checkEnvironmentVariables } from "./check-env";
import { DelegatedComputeInputs, getAuthenticatedOctokit, issueClosedEventHandler } from "./index";
import { GitHubEvent } from "./types/payload";
const { SUPABASE_URL, SUPABASE_KEY, openAi } = checkEnvironmentVariables();
afterEach(() => {
  jest.resetAllMocks();
});
const inputs: DelegatedComputeInputs = {
  eventName: "issues.closed" as GitHubEvent.ISSUES_CLOSED,
  issueOwner: "ubiquibot",
  issueRepository: "comment-incentives",
  issueNumber: "19",
  collaborators: `["pavlovcik"]`,
  installationId: "37627918", // "ubiquibot-dev" app
};

jest.mock("@actions/github", () => {
  const inputs: DelegatedComputeInputs = {
    eventName: "issues.closed" as GitHubEvent.ISSUES_CLOSED,
    issueOwner: "ubiquibot",
    issueRepository: "comment-incentives",
    issueNumber: "19",
    collaborators: `["pavlovcik"]`,
    installationId: "37627918", // "ubiquibot-dev" app
  };

  return {
    context: {
      payload: {
        inputs,
      },
    },
  };
});

import fs from "fs";
import path from "path";
export async function indexTest() {
  const authenticatedOctokit = await getAuthenticatedOctokit();
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

  const output = await issueClosedEventHandler(supabaseClient, openAi, authenticatedOctokit, inputs);

  const timestamp = new Date().getTime();
  const logFilePath = path.join(__dirname, `${timestamp}.html`);

  fs.writeFile(logFilePath, output, (err) => {
    if (err) {
      console.error("Error writing file", err);
    } else {
      console.log(`Output written to ${timestamp}.html`);
    }
  });
}

it(
  "runs",
  () =>
    indexTest().then(() => {
      console.log("done");
    }),
  60000
);
