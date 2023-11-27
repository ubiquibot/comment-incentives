import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { Comment, Issue, User } from "../../types/payload";
import { generatePermits } from "./generate-permits";
import { aggregateAndScoreContributions } from "./score-sources";
import { sumTotalScores } from "./sum-total-scores-per-contributor";

export const botCommandsAndHumanCommentsFilter = (comment: Comment) =>
  !comment.body.startsWith("/") /* No Commands */ && comment.user.type === "User"; /* No Bots */

export async function issueClosed({
  issue,
  issueComments,
  openAi,
  repoCollaborators,
  pullRequestComments,
  config,
  supabase,
}: IssueClosedParams) {
  const sourceScores = await aggregateAndScoreContributions({
    issue,
    issueComments,
    repoCollaborators,
    openAi,
    pullRequestComments,
  });
  // 2. sum total scores will sum the scores of every contribution, and organize them by contributor
  const contributorTotalScores = sumTotalScores(sourceScores);
  // 3. generate permits will generate a payment for every contributor
  const permitComment = await generatePermits(contributorTotalScores, issue, config, supabase);
  // 4. return the permit comment
  return permitComment;
}

interface IssueClosedParams {
  issue: Issue;
  issueComments: Comment[];
  openAi: OpenAI;
  repoCollaborators: User[];
  pullRequestComments: Comment[];
  config: any;
  supabase: SupabaseClient<any, "public", any>;
}