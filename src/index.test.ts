import { createClient } from "@supabase/supabase-js";
import { checkEnvironmentVariables } from "./check-env";
import { getAuthenticatedOctokit, issueClosedEventHandler } from "./index";
import { GitHubEvent } from "./types/payload";

const { SUPABASE_URL, SUPABASE_KEY, openAi } = checkEnvironmentVariables();

getAuthenticatedOctokit()
  .then((authenticatedOctokit) => {
    issueClosedEventHandler(createClient(SUPABASE_URL, SUPABASE_KEY), openAi, authenticatedOctokit, {
      eventName: GitHubEvent.ISSUES_CLOSED,
      issueOwner: "ubiquibot",
      issueRepository: "production",
      issueNumber: "84",
      collaborators: `["pavlovcik"]`,
      installationId: "37627918", // "ubiquibot-dev" app
    })
      .then(() => {
        console.log("issueClosedEventHandler done");
      })
      .catch((error) => {
        console.error(error);
      });
  })
  .catch((error) => {
    console.error(error);
  });
