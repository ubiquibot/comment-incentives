import Decimal from "decimal.js";
import { encodingForModel } from "js-tiktoken";
import OpenAI from "openai";
import { GitHubComment, GitHubIssue } from "../../types/payload";

export async function relevanceScoring(issue: GitHubIssue, contributorComments: GitHubComment[], openAi: OpenAI) {
  const prompt = generatePrompt(issue, contributorComments);
  const promptTokens = countTokensOfPrompt(prompt);
  const conversationTokens = countTokensOfConversation(issue, contributorComments);
  const estimatedOptimalModel = estimateOptimalModel(conversationTokens, promptTokens);

  console.dir(prompt, { depth: null, colors: true });

  const score = await sampleRelevanceScores(prompt, contributorComments, estimatedOptimalModel, openAi);
  return { score, tokens: conversationTokens, model: estimatedOptimalModel };
}

export function estimateOptimalModel(conversationTokens: number, promptTokens: number) {
  const totalSumOfTokens = conversationTokens + promptTokens;
  // we used the gpt-3.5-turbo encoder to estimate the amount of tokens.
  if (totalSumOfTokens <= 4097) {
    return "gpt-3.5-turbo";
  } else if (totalSumOfTokens <= 16385) {
    // TODO: maybe use gpt-3.5-turbo-16k encoder to recalculate tokens
    return "gpt-3.5-turbo-16k";
  } else {
    // TODO: maybe use gpt-4 encoder to recalculate tokens
    console.warn("Backup plan for development purposes only, but using gpt-4 due to huge context size");
    return "gpt-4";
  }
}
function generatePrompt(issue: GitHubIssue, comments: GitHubComment[]) {
  const specificationComment = issue.body;
  if (!specificationComment) {
    throw new Error("Issue specification comment is missing");
  }

  const PROMPT = `I need to evaluate the relevance of GitHub contributors' comments to a specific issue specification. Specifically, I'm interested in how much each comment helps to further define the issue specification or contributes new information or research relevant to the issue. Please provide a float between 0 and 1 to represent the degree of relevance. A score of 1 indicates that the comment is entirely relevant and adds significant value to the issue, whereas a score of 0 indicates no relevance or added value. Each contributor's comment is on a new line.\n\nIssue Specification:\n\`\`\`\n${
    issue.body
  }\n\`\`\`\n\nConversation:\n\`\`\`\n${comments
    .map((comment) => comment.body)
    .join(
      "\n"
    )}\n\`\`\`\n\n\nTo what degree are each of the comments in the conversation relevant and valuable to further defining the issue specification? Please reply with an array of float numbers between 0 and 1, corresponding to each comment in the order they appear. Each float should represent the degree of relevance and added value of the comment to the issue. The total length of the array in your response should equal exactly ${
    comments.length
  } elements.`;

  return PROMPT;
}

function countTokensOfPrompt(prompt: string) {
  const gpt3TurboEncoder = encodingForModel("gpt-3.5-turbo");
  const specificationTokens = gpt3TurboEncoder.encode(prompt);
  const sumOfSpecificationTokens = specificationTokens.length;
  const totalSumOfTokens = sumOfSpecificationTokens;
  return totalSumOfTokens;
}

export function countTokensOfConversation(issue: GitHubIssue, comments: GitHubComment[]) {
  const specificationComment = issue.body;
  if (!specificationComment) {
    throw new Error("Issue specification comment is missing");
  }

  const gpt3TurboEncoder = encodingForModel("gpt-3.5-turbo");
  const contributorCommentsWithTokens = comments.map((comment) => ({
    tokens: gpt3TurboEncoder.encode(comment.body),
    comment,
  }));

  const sumOfContributorTokens = contributorCommentsWithTokens.reduce((acc, { tokens }) => acc + tokens.length, 0);
  const specificationTokens = gpt3TurboEncoder.encode(specificationComment);
  const sumOfSpecificationTokens = specificationTokens.length;
  const totalSumOfTokens = sumOfSpecificationTokens + sumOfContributorTokens;

  return totalSumOfTokens;
}

export async function gptRelevance(openAi: OpenAI, model: string, prompt: string) {
  if (!openAi) throw new Error("OpenAI adapter is not defined");

  try {
    const response: OpenAI.Chat.ChatCompletion = await openAi.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
      temperature: 1,
      max_tokens: 128,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const parsedResponse = JSON.parse(response.choices[0].message.content as "[1, 1, 0.5, 0]") as number[];
    return parsedResponse;
  } catch (error) {
    return [];
  }
}

async function sampleRelevanceScores(
  prompt: string,
  contributorComments: GitHubComment[],
  estimatedOptimalModel: ReturnType<typeof estimateOptimalModel>,
  openAi: OpenAI
) {
  const BATCH_SIZE = 10;
  const MAX_ATTEMPTS = 10;
  const correctLength = contributorComments.length;
  const batchSamples = [] as Decimal[][];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const fetchedSamples = await fetchSamples({
      prompt,
      estimatedOptimalModel,
      maxConcurrency: BATCH_SIZE,
      openAi,
    });
    const filteredSamples = filterSamples(fetchedSamples, correctLength);
    if (filteredSamples.length >= BATCH_SIZE) {
      const averagedSample = averageSamples(filteredSamples, 10);
      batchSamples.push(averagedSample);
      break;
    }
  }
  const average = averageSamples(batchSamples, 4);

  return average;
}

async function fetchSamples({ prompt, estimatedOptimalModel, maxConcurrency, openAi }: InEachRequestParams) {
  const batchPromises = [];
  for (let i = 0; i < maxConcurrency; i++) {
    const requestPromise = gptRelevance(openAi, estimatedOptimalModel, prompt);
    batchPromises.push(requestPromise);
  }
  const batchResults = await Promise.all(batchPromises);
  return batchResults;
}

interface InEachRequestParams {
  prompt: string;
  estimatedOptimalModel: ReturnType<typeof estimateOptimalModel>;
  maxConcurrency: number;
  openAi: OpenAI;
}

function filterSamples(batchResults: number[][], correctLength: number) {
  return batchResults.filter((result) => {
    if (result.length != correctLength) {
      console.error("Results are not the expected length", {
        batchResultsLength: batchResults.length,
        result,
      });
      return false;
    } else {
      return true;
    }
  });
}

function averageSamples(batchResults: (number | Decimal)[][], precision: number) {
  const averageScores = batchResults[0]
    .map((_, columnIndex) => {
      let sum = new Decimal(0);
      batchResults.forEach((row) => {
        sum = sum.plus(row[columnIndex]);
      });
      return sum.dividedBy(batchResults.length);
    })
    .map((score) => score.toDecimalPlaces(precision));

  return averageScores;
}
