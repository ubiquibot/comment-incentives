import Decimal from "decimal.js";
import { GitHubIssue, GitHubUser } from "../../types/payload";
import { ContributorView } from "./contribution-style-types";
import { UserScoreDetails } from "./issue-shared-types";

export async function assigneeScoring({
  issue,
  source,
  view,
}: {
  issue: GitHubIssue;
  source: GitHubUser[];
  view: ContributorView;
}): Promise<UserScoreDetails[]> {
  // get the price label
  const priceLabels = issue.labels.filter((label) => label.name.startsWith("Price: "));

  console.trace({ priceLabels });

  if (!priceLabels.length) {
    throw console.warn("There are no price labels in this repository.");
  }

  // get the smallest price label
  const sortedPriceLabels = priceLabels.sort((a, b) => {
    const priceA = parseFloat(a.name.replace("Price: ", ""));
    const priceB = parseFloat(b.name.replace("Price: ", ""));
    return priceA - priceB;
  });

  if (!sortedPriceLabels.length) {
    throw console.warn("There are no sorted price labels.");
  }

  const smallestPriceLabel = sortedPriceLabels[0];

  if (!smallestPriceLabel) {
    throw console.warn("Smallest price label is undefined");
  }

  console.trace({ smallestPriceLabel });

  const priceLabelName = smallestPriceLabel.name;

  const priceLabelMatch = priceLabelName.match(/\d+(\.\d+)?/);

  const priceLabel = priceLabelMatch?.shift();

  if (!priceLabel) {
    throw console.warn("Price label is undefined");
  }

  // get the price
  const price = new Decimal(priceLabel);

  // get the number of assignees
  const numberOfAssignees = source.length;

  const assigneeRewards = source.map((assignee) => {
    // get the assignee multiplier
    const assigneeMultiplier = new Decimal(1); // TODO: get the assignee multiplier from the database

    // calculate the total
    const splitReward = price.div(numberOfAssignees).times(assigneeMultiplier);

    // return the total
    const details: UserScoreDetails = {
      score: splitReward,

      view: view,
      role: "Assignee",
      contribution: "Task",

      scoring: {
        issueComments: null,
        reviewComments: null,
        specification: null,
        task: price,
      },
      source: {
        issue: issue,
        user: assignee,
      },
    };

    return details;
  });

  return assigneeRewards;
}
