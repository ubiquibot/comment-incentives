import { GitHubComment, GitHubUser } from "../../types/payload";
import { CommentScoring } from "./comment-scoring-rubric";

export function perUserCommentScoring(
  user: GitHubUser,
  comments: GitHubComment[],
  scoringRubric: CommentScoring
): CommentScoring {
  for (const comment of comments) {
    scoringRubric.computeWordScore(comment, user.id);
    scoringRubric.computeElementScore(comment, user.id);
  }
  scoringRubric.compileTotalUserScores();
  return scoringRubric;
}
