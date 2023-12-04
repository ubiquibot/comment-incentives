import * as core from "@actions/core";
import * as github from "@actions/github";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import zlib from "zlib";
import { checkEnvironmentVariables } from "./check-env";
import { issueClosed } from "./handlers/issue/issue-closed";
import { IssueClosedEventPayload } from "./types/payload";
// import cloneDeep from "lodash/cloneDeep";

run()
  .then((result) => core.setOutput("result", result))
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });

async function run() {
  const { SUPABASE_URL, SUPABASE_KEY } = checkEnvironmentVariables();
  // const payload = cloneDeep(github.context.payload);
  const webhookPayload = github.context.payload;

  const eventName = webhookPayload.inputs.eventName;
  const handlerPayload = JSON.parse(webhookPayload.inputs.payload);

  if (eventName === "issueClosed") {
    return await issueClosedEventHandler(SUPABASE_URL, SUPABASE_KEY, handlerPayload);
  }
}

async function issueClosedEventHandler(supabaseUrl: string, supabaseKey: string, payload: IssueClosedEventPayload) {
  const SUPABASE_CLIENT = createClient(supabaseUrl, supabaseKey);
  const result: string = await issueClosed({
    issue: payload.issue,
    issueComments: payload.issueComments,
    openAi: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    repoCollaborators: payload.repoCollaborators,
    pullRequestComments: payload.pullRequestComments,
    config: payload.botConfig,
    supabase: SUPABASE_CLIENT,
  });
  const compressedString = zlib.gzipSync(Buffer.from(result.replace(/<!--[\s\S]*?-->/g, "")));

  return compressedString.toJSON();
}
