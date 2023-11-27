import * as core from "@actions/core";
import * as github from "@actions/github";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import zlib from "zlib";
import { issueClosed } from "./src/handlers/issue/issue-closed";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  core.setFailed("OPENAI_API_KEY not set");
}

const SUPABASE_URL = process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  core.setFailed("SUPABASE_URL not set");
}
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_KEY) {
  core.setFailed("SUPABASE_KEY not set");
}

// Define an asynchronous function to handle the logic
async function run() {
  try {
    const payload = JSON.parse(
      JSON.stringify(github.context.payload, null, 2)
    );
    const eventName = payload.inputs.eventName;
    const handlerPayload = JSON.parse(payload.inputs.payload);

    if (eventName === "issueClosed") {
      const SUPABASE_CLIENT = createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );
      const result: string = await issueClosed(
        { issue: handlerPayload.issue, issueComments: handlerPayload.issueComments, openAi: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), repoCollaborators: handlerPayload.repoCollaborators, pullRequestComments: handlerPayload.pullRequestComments, config: handlerPayload.botConfig, supabase: SUPABASE_CLIENT },
      );
      const compressedString = zlib.gzipSync(
        Buffer.from(result.replace(/<!--[\s\S]*?-->/g, ""))
      );
      core.setOutput("result", {
        comment: compressedString.toJSON(),
      });
    }
  } catch (error) {
    console.error(error);
    core.setFailed(error);
  }
}

// Call the function
run();
