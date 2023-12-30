import OpenAI from "openai";
import { Context as ProbotContext, ProbotOctokit } from "probot";
// import { Logs } from "../adapters/supabase/helpers/tables/logs";
// import { BotConfig } from "./configuration-types";
import { Payload } from "./payload";

export interface Context {
  event: ProbotContext;
  //   config: BotConfig;
  openAi: OpenAI | null;
  //   logger: Logs;
  payload: Payload;
  octokit: InstanceType<typeof ProbotOctokit>;
}
