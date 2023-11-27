import * as core from "@actions/core";
import * as github from "@actions/github";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import zlib from "zlib";
import { checkEnvironmentVariables } from "./check-env";
import { issueClosed } from "./handlers/issue/issue-closed";

async function run() {
  const { SUPABASE_URL, SUPABASE_KEY } = checkEnvironmentVariables();
  const payload = JSON.parse(JSON.stringify(github.context.payload, null, 2));
  const eventName = payload.inputs.eventName;
  const handlerPayload = JSON.parse(payload.inputs.payload);

  if (eventName === "issueClosed") {
    const SUPABASE_CLIENT = createClient(SUPABASE_URL, SUPABASE_KEY);
    const result: string = await issueClosed({
      issue: handlerPayload.issue,
      issueComments: handlerPayload.issueComments,
      openAi: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      repoCollaborators: handlerPayload.repoCollaborators,
      pullRequestComments: handlerPayload.pullRequestComments,
      config: handlerPayload.botConfig,
      supabase: SUPABASE_CLIENT,
    });
    const compressedString = zlib.gzipSync(Buffer.from(result.replace(/<!--[\s\S]*?-->/g, "")));
    core.setOutput("result", {
      comment: compressedString.toJSON(),
    });
  }
}

run()
  // .then(() => {})
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });
