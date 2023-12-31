import Decimal from "decimal.js";

import { GitHubComment, GitHubIssue, GitHubUser } from "../../types/payload";
import { allCommentScoring } from "./all-comment-scoring";
import { UserScoreDetails } from "./issue-shared-types";
import { addRelevanceAndFormatScoring } from "./relevance-format-scoring";

// import Runtime from "../../../../bindings/bot-runtime";
import { ContributorView } from "./contribution-style-types";

export async function specificationScoring({
  issue,
  view,
  collaborators,
}: {
  issue: GitHubIssue;
  view: ContributorView;
  collaborators: GitHubUser[];
}): Promise<UserScoreDetails[]> {
  // const logger = Runtime.getState().logger;
  const userScoreDetails = [] as UserScoreDetails[];

  const issueAsComment = castIssueAsComment(issue);

  // synthetic relevance score
  const RELEVANT = [{ comment: issueAsComment, user: issue.user, score: new Decimal(1) }];

  const formatting = await allCommentScoring({
    issue,
    comments: [issueAsComment],
    view,
    collaborators,
  });
  const scoreDetails = addRelevanceAndFormatScoring(RELEVANT, formatting);
  for (const user in scoreDetails) {
    const userScore = scoreDetails[user];
    if (userScore.contributionClass !== "Issue Issuer Comment") continue;

    const userScoreDetail: UserScoreDetails = {
      score: userScore.commentScores[issue.user.id].totalScoreTotal,
      view: view,
      role: "Issuer",
      contribution: "Specification",
      scoring: {
        specification: userScore,
        issueComments: null,
        reviewComments: null,
        task: null,
      },
      source: {
        user: issue.user,
        issue: issue,
      },
    };

    userScoreDetails.push(userScoreDetail);
  }
  return userScoreDetails;
}

function castIssueAsComment(issue: GitHubIssue): GitHubComment {
  return {
    body: issue.body,
    user: issue.user,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    id: issue.id,
    node_id: issue.node_id,
    author_association: issue.author_association,
    html_url: issue.html_url,
    url: issue.url,
  } as GitHubComment;
}
