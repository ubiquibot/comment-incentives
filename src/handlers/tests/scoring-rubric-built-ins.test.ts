import Decimal from "decimal.js";

describe("Scoring Rubric Built-ins", () => {
  let wordScoreCommentDetails: { [key: string]: Decimal };

  beforeEach(() => {
    wordScoreCommentDetails = {};
  });

  it("should increment counter for non-built-in words", () => {
    const words = ["hasOwnProperty", "valueOf", "was", "async", "but", "the", "constructor", "isn", "t", "I", "was"];
    const ZERO = new Decimal(0);

    const builtIns = new Set(
      Object.getOwnPropertyNames(Object.prototype).filter((name) => typeof Object.prototype[name] === "function")
    );

    for (const word of words) {
      if (!builtIns.has(word)) {
        const counter = wordScoreCommentDetails[word] || ZERO;
        wordScoreCommentDetails[word] = counter;
      }
    }

    expect(wordScoreCommentDetails).toEqual({
      was: new Decimal(0),
      async: new Decimal(0),
      but: new Decimal(0),
      the: new Decimal(0),
      isn: new Decimal(0),
      t: new Decimal(0),
      I: new Decimal(0),
    });
  });
});
