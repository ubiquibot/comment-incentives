import Decimal from "decimal.js";

import OpenAI from "openai";
import { GitHubComment, GitHubIssue, GitHubUser } from "../../types/payload";
import { allCommentScoring } from "./all-comment-scoring";
import { CommentScoring } from "./comment-scoring-rubric";
import { ContributorView } from "./contribution-style-types";
import { UserScoreDetails } from "./issue-shared-types";
import { addRelevanceAndFormatScoring } from "./relevance-format-scoring";
import { relevanceScoring } from "./relevance-scoring";

export async function commentsScoring({
  issue,
  source,
  view,
  collaborators,
  openAi,
}: {
  issue: GitHubIssue;
  source: GitHubComment[];
  view: ContributorView;
  collaborators: GitHubUser[];
  openAi: OpenAI;
}): Promise<UserScoreDetails[]> {
  const relevance = await relevanceScoring(issue, source, openAi);
  const relevanceWithMetaData = relevance.score.map(enrichRelevanceData(source));

  const formatting: CommentScoring[] = await allCommentScoring({
    issue,
    comments: source,
    view,
    collaborators,
  });
  const formattingWithRelevance: CommentScoring[] = addRelevanceAndFormatScoring(relevanceWithMetaData, formatting);

  const userScoreDetails = formattingWithRelevance.reduce((acc, commentScoring) => {
    for (const userId in commentScoring.commentScores) {
      const userScore = commentScoring.commentScores[userId];

      const userScoreDetail: UserScoreDetails = {
        score: userScore.totalScoreTotal,
        view,
        role: null,
        contribution: "Comment",
        scoring: {
          issueComments: view === "Issue" ? commentScoring : null,
          reviewComments: view === "Review" ? commentScoring : null,
          specification: null,
          task: null,
        },
        source: {
          issue,
          user: Object.values(userScore.details)[0].comment.user,
        },
      };

      acc.push(userScoreDetail);
    }
    return acc;
  }, [] as UserScoreDetails[]);

  return userScoreDetails;
}

export interface EnrichedRelevance {
  comment: GitHubComment;
  user: GitHubUser;
  score: Decimal;
}

export function enrichRelevanceData(
  contributorComments: GitHubComment[]
): (value: Decimal, index: number, array: Decimal[]) => EnrichedRelevance {
  return (score, index) => ({
    comment: contributorComments[index],
    user: contributorComments[index].user,
    score,
  });
}
