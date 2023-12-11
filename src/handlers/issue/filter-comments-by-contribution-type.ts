import { GitHubComment, GitHubUser } from "../../types/payload";
import { ContributorClasses, ContributorClassesKeys, ContributorView } from "./contribution-style-types";
type CommentsSortedByClass = {
  [className in keyof ContributorClasses]: null | GitHubComment[];
};

export function sortCommentsByClass(
  usersByClass: ContributorClasses,
  contributorComments: GitHubComment[],
  view: ContributorView
): CommentsSortedByClass {
  const result = {} as CommentsSortedByClass;

  for (const role of Object.keys(usersByClass)) {
    if (role.startsWith(view)) {
      const key = role as ContributorClassesKeys;
      if (key in usersByClass) {
        result[key] = filterComments(key, usersByClass, contributorComments);
      }
    }
  }

  return result;
}

function filterComments(
  role: ContributorClassesKeys,
  usersOfCommentsByRole: ContributorClasses,
  contributorComments: GitHubComment[]
): GitHubComment[] | null {
  const users = usersOfCommentsByRole[role];
  if (!users) return null;
  if (Array.isArray(users)) {
    return contributorComments.filter((comment: GitHubComment) => users.some((user: GitHubUser) => user.id == comment.user.id));
  } else {
    return contributorComments.filter((comment: GitHubComment) => comment.user.id === users.id);
  }
}
