import test from "node:test";
import assert from "node:assert/strict";
import { nextSequenceNumber, reactionAverage, timedScore } from "../src/talent/logic.ts";

test("number patterns match the four server rules", () => {
  assert.equal(nextSequenceNumber([3, 7, 11, 15]), 19);
  assert.equal(nextSequenceNumber([2, 4, 8, 16]), 32);
  assert.equal(nextSequenceNumber([1, 3, 6, 10]), 15);
  assert.equal(nextSequenceNumber([2, 5, 7, 12]), 19);
});
test("reaction score averages all rounds and timed games penalize mistakes", () => {
  assert.equal(reactionAverage([201, 220, 190, 250, 180]), 208);
  assert.equal(timedScore(12, 3), 9);
  assert.equal(timedScore(1, 5), 0);
});
