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
      issueRepository: "comment-incentives",
      issueNumber: "1",
      collaborators: `["ubiquibot"]`,
      installationId: "0",
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
