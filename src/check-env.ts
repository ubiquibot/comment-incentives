import * as core from "@actions/core";

export function checkEnvironmentVariables() {
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
  return { SUPABASE_URL, SUPABASE_KEY };
}
