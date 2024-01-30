import { ObjectOptions, StaticDecode, StringOptions, Type as T, TProperties } from "@sinclair/typebox";
import ms from "ms";
import { ajv } from "../utils/ajv";
import { validHTMLElements } from "./valid-html-elements";

const promotionComment =
  "###### If you enjoy the DevPool experience, please follow [Ubiquity on GitHub](https://github.com/ubiquity) and star [this repo](https://github.com/ubiquity/devpool-directory) to show your support. It helps a lot!";
const defaultGreetingHeader =
  "Thank you for contributing! Please be sure to set your wallet address before completing your first task so that you can collect your reward.";

const htmlEntities = validHTMLElements.map((value) => T.Literal(value));

const allHtmlElementsSetToZero = validHTMLElements.reduce(
  (accumulator, current) => {
    accumulator[current] = 0;
    return accumulator;
  },
  {} as Record<keyof HTMLElementTagNameMap, number>
);

const allCommands = ["start", "stop", "help", "autopay", "query", "ask", "multiplier", "labels", "authorize", "wallet"];

const defaultTimeLabels = ["Time: <1 Hour", "Time: <2 Hours", "Time: <4 Hours", "Time: <1 Day", "Time: <1 Week"];

const defaultPriorityLabels = [
  "Priority: 1 (Normal)",
  "Priority: 2 (Medium)",
  "Priority: 3 (High)",
  "Priority: 4 (Urgent)",
  "Priority: 5 (Emergency)",
];

function strictObject<T extends TProperties>(obj: T, options?: ObjectOptions) {
  return T.Object<T>(obj, { additionalProperties: false, default: {}, ...options });
}

export function stringDuration(options?: StringOptions) {
  return T.Transform(T.String(options))
    .Decode((value) => {
      const decoded = ms(value);
      if (decoded === undefined || isNaN(decoded)) {
        throw new Error(`Invalid duration string: ${value}`);
      }
      return ms(value);
    })
    .Encode((value) => ms(value));
}

const botConfigSchema = strictObject(
  {
    keys: strictObject({
      evmPrivateEncrypted: T.Optional(T.String()),
      openAi: T.Optional(T.String()),
    }),
    features: strictObject({
      assistivePricing: T.Boolean({ default: false }),
      defaultLabels: T.Array(T.String(), { default: [] }),
      newContributorGreeting: strictObject({
        enabled: T.Boolean({ default: false }),
        header: T.String({ default: defaultGreetingHeader }),
        displayHelpMenu: T.Boolean({ default: true }),
        footer: T.String({ default: promotionComment }),
      }),
      publicAccessControl: strictObject({
        setLabel: T.Boolean({ default: true }),
        fundExternalClosedIssue: T.Boolean({ default: true }),
      }),
      isNftRewardEnabled: T.Boolean({ default: false }),
    }),

    timers: strictObject({
      reviewDelayTolerance: stringDuration({ default: "1 day" }),
      taskStaleTimeoutDuration: stringDuration({ default: "4 weeks" }),
      taskFollowUpDuration: stringDuration({ default: "0.5 weeks" }),
      taskDisqualifyDuration: stringDuration({ default: "1 week" }),
    }),
    payments: strictObject({
      maxPermitPrice: T.Number({ default: Number.MAX_SAFE_INTEGER }),
      evmNetworkId: T.Number({ default: 1 }),
      basePriceMultiplier: T.Number({ default: 1 }),
      issueCreatorMultiplier: T.Number({ default: 1 }),
    }),
    disabledCommands: T.Array(T.String(), { default: allCommands }),
    incentives: strictObject({
      comment: strictObject({
        elements: T.Record(T.Union(htmlEntities), T.Number({ default: 0 }), { default: allHtmlElementsSetToZero }),
        totals: strictObject({
          character: T.Number({ default: 0, minimum: 0 }),
          word: T.Number({ default: 0, minimum: 0 }),
          sentence: T.Number({ default: 0, minimum: 0 }),
          paragraph: T.Number({ default: 0, minimum: 0 }),
          comment: T.Number({ default: 0, minimum: 0 }),
        }),
      }),
    }),
    labels: strictObject({
      time: T.Array(T.String(), { default: defaultTimeLabels }),
      priority: T.Array(T.String(), { default: defaultPriorityLabels }),
    }),
    miscellaneous: strictObject({
      maxConcurrentTasks: T.Number({ default: Number.MAX_SAFE_INTEGER }),
      promotionComment: T.String({ default: promotionComment }),
      registerWalletWithVerification: T.Boolean({ default: false }),
      openAiTokenLimit: T.Number({ default: 100000 }),
    }),
  },
  { default: undefined } // top level object can't have default!
);
export const validateBotConfig = ajv.compile(botConfigSchema);

export type BotConfig = StaticDecode<typeof botConfigSchema>;
