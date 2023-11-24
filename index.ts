import { createClient } from "@supabase/supabase-js";
import zlib from "zlib";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { issueClosed } from "./handlers//issue/issue-closed";
import OpenAI from "openai";

// Define an asynchronous function to handle the logic
async function run() {
  try {
    const payload = JSON.parse(
      JSON.stringify(github.context.payload, undefined, 2)
    );
    const eventName = payload.inputs.eventName;
    const handlerPayload = JSON.parse(payload.inputs.payload);

    if (eventName === "issueClosed") {
      const supabase = createClient(
        handlerPayload.supabaseUrl,
        handlerPayload.supabaseKey
      );
      const result: string = await issueClosed(
        handlerPayload.issue,
        handlerPayload.issueComments,
        new OpenAI({ apiKey: handlerPayload.openAiKey }),
        handlerPayload.repoCollaborators,
        handlerPayload.pullRequestComments,
        handlerPayload.botConfig, 
        handlerPayload.X25519_PRIVATE_KEY,
        supabase,
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
