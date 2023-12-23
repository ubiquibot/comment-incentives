import OpenAI from "openai";
import { GitHubComment, GitHubIssue, GitHubUser } from "../../types/payload";
import { assigneeScoring as assigneeTaskScoring } from "./assignee-scoring";
import { commentsScoring } from "./evaluate-comments";
import { botCommandsAndHumanCommentsFilter } from "./issue-closed";
import { UserScoreDetails } from "./issue-shared-types";
import { specificationScoring as issuerSpecificationScoring } from "./specification-scoring";

export async function aggregateAndScoreContributions({
  issue,
  issueComments,
  collaborators,
  openAi,
  pullRequestComments,
}: ScoreParams): Promise<UserScoreDetails[]> {
  const issueIssuerSpecification = await issuerSpecificationScoring({
    issue,
    view: "Issue",
    collaborators,
  });

  const issueAssigneeTask = await assigneeTaskScoring({
    issue,
    source: issue.assignees.filter((assignee): assignee is GitHubUser => Boolean(assignee)),
    view: "Issue",
  });

  const issueContributorComments = await commentsScoring({
    issue,
    source: issueComments.filter(botCommandsAndHumanCommentsFilter),
    view: "Issue",
    collaborators,
    openAi,
  });

  const reviewContributorComments = await commentsScoring({
    issue,
    source: pullRequestComments.filter(botCommandsAndHumanCommentsFilter),
    view: "Review",
    collaborators,
    openAi,
  });

  // TODO: review pull request scoring
  // TODO: code contribution scoring

  return [...issueIssuerSpecification, ...issueAssigneeTask, ...issueContributorComments, ...reviewContributorComments];
}

interface ScoreParams {
  issue: GitHubIssue;
  issueComments: GitHubComment[];
  collaborators: GitHubUser[];
  openAi: OpenAI;
  pullRequestComments: GitHubComment[];
}

// different ways to earn:

/**
 *
 * 1. write a specification
 * - things to collect:
 * -  - author (User)
 * -  - issue (Issue)
 * - scoring:
 * -  - formatting
 * -  - word count
 * -  - clarity
 *
 * 2. be assigned a task and complete it
 * - things to collect:
 * -  - assignees (User[])
 * -  - issue (Issue)
 * - scoring:
 * -  - just take the price of the issue, divide by amount of assignees
 *
 * 3. comment on the issue
 * - things to collect:
 * -  - author (User)
 * -  - issue (Issue)
 * -  - comments (Comment[])
 * - scoring:
 * -  - formatting
 * -  - word count
 * -  - relevance
 *
 * 4. comment on the pull request
 * - things to collect:
 * -  - author (User)
 * -  - issue (Issue)
 * -  - comments (Comment[])
 * - scoring:
 * -  - formatting
 * -  - word count
 * -  - relevance
 *
 * 5. review the pull request
 * - things to collect:
 * -  - reviewer (User)
 * -  - issue (Issue)
 * -  - comments (Comment[])
 * -  - pull request (PullRequest)
 * -  - review (Review)
 * -  - review comments (Comment[])
 * - scoring:
 * -  - formatting
 * -  - word count
 * -  - relevance
 *
 * 6. contribute code
 * - things to collect:
 * -  - author (User)
 * -  - issue (Issue)
 * -  - pull request (PullRequest)
 * -  - commits (Commit[])
 * -  - files (File[])
 * - scoring:
 * -  - ???
 *
 */
