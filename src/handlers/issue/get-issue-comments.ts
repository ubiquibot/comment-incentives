import { Octokit } from "@octokit/rest";
import { getLinkedPullRequests } from "../../helpers/get-linked-issues-and-pull-requests";
import { GitHubComment, GitHubIssue } from "../../types/payload";

// export async function getPullRequestComments(owner: string, repository: string, issueNumber: number) {
//   const pullRequestComments: Comment[] = [];
//   const linkedPullRequests = await getLinkedPullRequests({ owner, repository, issue: issueNumber });
//   if (linkedPullRequests.length) {
//     const linkedCommentsPromises = linkedPullRequests.map((pull) =>
//       getAllIssueComments(owner, repository, pull.number)
//     );
//     const linkedCommentsResolved = await Promise.all(linkedCommentsPromises);
//     for (const linkedComments of linkedCommentsResolved) {
//       pullRequestComments.push(...linkedComments);
//     }
//   }
//   return pullRequestComments;
// }

async function getAllIssueComments(issue: GitHubIssue) {
  const owner = issue.owner;
  const repo = issue.repository_url;
  const issueNumber = issue.number;

  const opt = {
    owner: owner,
    repo: repository,
    issue_number: issueNumber,
    per_page: 100,
    mediaType: {
      format: "raw",
    },
  };

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  return (await octokit.paginate(octokit.rest.issues.listComments, opt)) as GitHubComment[];
}
