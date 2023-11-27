import { Comment, Issue, User } from "../../types/payload";
import { commentScoringByContributionClass } from "./comment-scoring-by-contribution-style";
import { CommentScoring } from "./comment-scoring-rubric";
import { ContributorClassesKeys, ContributorView } from "./contribution-style-types";
import { sortCommentsByClass } from "./filter-comments-by-contribution-type";
import { sortUsersByClass } from "./identify-user-ids";
import { perUserCommentScoring } from "./per-user-comment-scoring";

export async function allCommentScoring({
  issue,
  comments,
  view,
  repoCollaborators,
}: {
  issue: Issue;
  comments: Comment[];
  view: ContributorView;
  repoCollaborators: User[];
}): Promise<CommentScoring[]> {
  const usersByClass = await sortUsersByClass(issue, comments, repoCollaborators);
  const commentsByClass = sortCommentsByClass(usersByClass, comments, view);
  const contributionClasses = Object.keys(usersByClass).map((key) => key as ContributorClassesKeys);
  return contributionClasses
    .filter((className: string) => className.endsWith("Comment"))
    .flatMap((contributionStyle) => {
      const commentsOfRole = commentsByClass[contributionStyle as keyof typeof commentsByClass];
      const scoring = commentScoringByContributionClass[contributionStyle]();

      const selection = usersByClass[contributionStyle as keyof typeof usersByClass];

      if (!selection) {
        console.log(`No ${String(contributionStyle)} found`);
        return [];
      }

      // Ensure selection is always an array
      const users = Array.isArray(selection) ? selection : [selection];

      users.forEach((user) => {
        if (!commentsOfRole) {
          return [];
        }
        perUserCommentScoring(
          user,
          commentsOfRole.filter((comment) => comment.user.id === user.id),
          scoring
        );
      });
      return scoring;
    });
}
