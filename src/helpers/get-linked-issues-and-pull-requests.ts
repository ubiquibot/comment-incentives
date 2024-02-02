import { Octokit } from "@octokit/rest";
// import { Context } from '../types/context';

interface GetLinkedParams {
  authenticatedOctokit: Octokit,
  owner: string;
  repository: string;
  issue?: number;
  pull?: number;
}

interface GetLinkedResults {
  organization: string;
  repository: string;
  number: number;
  href: string;
}

export async function getLinkedIssues({ authenticatedOctokit, owner, repository, pull }: GetLinkedParams) {
  if(!pull) return null;
  const { data } = await authenticatedOctokit.pulls.get({
    owner,
    repo: repository,
    pull_number: pull
  });

  const body = data.body;
  if(!body) return null;

  const match = body.match(/#(\d+)/);
  const issueNumber = match ? match[1] : null;

  if (!issueNumber) {
    return null;
  }

  const issue = await authenticatedOctokit.issues.get({
    owner,
    repo: repository,
    issue_number: Number(issueNumber)
  });

  return issue.data.html_url;
}

export async function getLinkedPullRequests(
  // context: Context,
  { authenticatedOctokit, owner, repository, issue }: GetLinkedParams
): Promise<GetLinkedResults[]> {
  // const logger = context.logger;
  const collection = [] as GetLinkedResults[];
  const pulls = await getAllPullRequests(authenticatedOctokit, owner, repository);
  const currentIssue = await authenticatedOctokit.issues.get({
    owner,
    repo: repository,
    issue_number: issue
  });
  for (const pull of pulls) {
    const linkedIssue = await getLinkedIssues({
      authenticatedOctokit,
      owner: owner,
      repository: repository,
      pull: pull.number,
    });

    if(linkedIssue === currentIssue.data.html_url) {
      collection.push({
        organization: owner,
        repository,
        number: pull.number,
        href: pull.html_url,
      })
    }
  }

  return collection;
}

export async function getAllPullRequests(authenticatedOctokit: Octokit, owner: string, repo: string, state: "open" | "closed" | "all" = "open",) {

  try {
    const pulls = await authenticatedOctokit.paginate(authenticatedOctokit.rest.pulls.list, {
      owner,
      repo,
      state,
      per_page: 100,
    });
    return pulls;
  } catch (err: unknown) {
    return [];
  }
}