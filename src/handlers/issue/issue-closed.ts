import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GitHubComment, GitHubIssue, GitHubUser } from "../../types/payload";
import { generatePermits } from "./generate-permits";
import { aggregateAndScoreContributions } from "./score-sources";
import { sumTotalScores } from "./sum-total-scores-per-contributor";
import { PluginSettings } from "../..";

export function botCommandsAndHumanCommentsFilter(comment: GitHubComment) {
  return !comment.body.startsWith("/") /* No Commands */ && comment.user.type === "User"; /* No Bots */
}

export async function issueClosed({
  issue,
  issueComments,
  openAi,
  collaborators,
  pullRequestComments,
  settings,
  supabase,
}: IssueClosedParams) {
  const sourceScores = await aggregateAndScoreContributions({
    issue,
    issueComments,
    collaborators,
    openAi,
    pullRequestComments,
  });
  // 2. sum total scores will sum the scores of every contribution, and organize them by contributor
  const contributorTotalScores = sumTotalScores(sourceScores);
  // 3. generate permits will generate a payment for every contributor
  const permitComment = await generatePermits(contributorTotalScores, issue, settings, supabase);
  // 4. return the permit comment
  return permitComment;
}

interface IssueClosedParams {
  issue: GitHubIssue;
  issueComments: GitHubComment[];
  openAi: OpenAI;
  collaborators: GitHubUser[];
  pullRequestComments: GitHubComment[];
  settings: PluginSettings;
  supabase: SupabaseClient;
}
