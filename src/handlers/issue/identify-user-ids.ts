import { GitHubComment, GitHubIssue, GitHubUser } from "../../types/payload";
import { ContributorClasses } from "./contribution-style-types";

export async function sortUsersByClass(
  issue: GitHubIssue,
  contributorComments: GitHubComment[],
  collaborators: GitHubUser[]
): Promise<ContributorClasses> {
  const filtered = await filterUsers(issue, contributorComments, collaborators);

  return returnValues(filtered.issuer, filtered.assignees, filtered.collaborators, filtered.contributors);
}

async function filterUsers(issue: GitHubIssue, contributorComments: GitHubComment[], collaborators: GitHubUser[]) {
  const issuer = issue.user;
  const assignees = issue.assignees.filter((assignee): assignee is GitHubUser => assignee !== null);

  const allRoleUsers: GitHubUser[] = [
    issuer,
    ...assignees.filter((user): user is GitHubUser => user !== null),
    ...collaborators.filter((user): user is GitHubUser => user !== null),
  ];
  const humanUsersWhoCommented = contributorComments
    .filter((comment) => comment.user.type === "User")
    .map((comment) => comment.user);

  const contributors = humanUsersWhoCommented.filter(
    (user: GitHubUser) => !allRoleUsers.some((_user) => _user?.id === user.id)
  );
  const uniqueContributors = Array.from(new Map(contributors.map((user) => [user.id, user])).values());
  return {
    issuer,
    assignees,
    collaborators: collaborators.filter((collaborator) => collaborator.id !== issuer.id),
    contributors: uniqueContributors,
  };
}

function returnValues(
  issuer: GitHubUser,
  assignees: GitHubUser[],
  collaborators: GitHubUser[],
  contributors: GitHubUser[]
): ContributorClasses {
  return {
    "Issue Issuer Comment": issuer,
    "Issue Assignee Comment": assignees,
    "Issue Collaborator Comment": collaborators,
    "Issue Contributor Comment": contributors,

    "Issue Issuer Specification": issuer,
    "Issue Assignee Task": assignees,

    "Review Issuer Comment": issuer,
    "Review Assignee Comment": assignees,
    "Review Collaborator Comment": collaborators,
    "Review Contributor Comment": contributors,
    "Review Issuer Approval": issuer,
    "Review Issuer Rejection": issuer,
    "Review Collaborator Approval": collaborators,
    "Review Collaborator Rejection": collaborators,
    "Review Issuer Code": issuer,
    "Review Assignee Code": assignees,
    "Review Collaborator Code": collaborators,
  };
}
