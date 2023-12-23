import { OpenAI } from "openai";

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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return { SUPABASE_URL, SUPABASE_KEY, openAi: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) };
}
