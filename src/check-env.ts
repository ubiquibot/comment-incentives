import { OpenAI } from "openai";
import { config } from "dotenv";
config();
export function checkEnvironmentVariables() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;

  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL not set");
  }
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_KEY) {
    throw new Error("SUPABASE_KEY not set");
  }

  // Use environment variables or other secure means to store these values
  const appId = process.env.UBIQUIBOT_APP_ID;
  const privateKey = process.env.UBIQUIBOT_APP_PRIVATE_KEY;

  if (!appId) throw new Error("Missing UBIQUIBOT_APP_ID environment variable");
  if (!privateKey) throw new Error("Missing UBIQUIBOT_APP_PRIVATE_KEY environment variable");

  return {
    SUPABASE_URL,
    SUPABASE_KEY,
    openAi: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    appId,
    privateKey,
  };
}
