import { test } from "node:test";
import assert from "node:assert/strict";
import { manualScene, DURATION, stepFrame, STEP_STARTS, STEP_LENGTHS } from "../src/lessons/agent-loop/manualScene.ts";

test("paste precedes send; send clears the composer", () => {
  assert.equal(manualScene(stepFrame(2, 34)).composing, false);
  assert.equal(manualScene(stepFrame(2, 35)).composing, true);
  assert.equal(manualScene(stepFrame(4, 41)).sent, false);
  assert.equal(manualScene(stepFrame(4, 42)).sent, true);
  assert.equal(manualScene(stepFrame(4, 42)).composing, false);
});
test("the local file changes only on paste, then save", () => {
  assert.equal(manualScene(stepFrame(7, 75)).pasted, false);
  assert.equal(manualScene(stepFrame(9, 34)).pasted, false);
  assert.equal(manualScene(stepFrame(9, 35)).pasted, true);
  assert.equal(manualScene(stepFrame(9, 35)).saved, false);
  assert.equal(manualScene(stepFrame(10, 35)).saved, true);
});
test("updated file is composed before feedback is sent", () => {
  assert.equal(manualScene(stepFrame(13, 75)).composing, true);
  assert.equal(manualScene(stepFrame(13, 75)).feedbackSent, false);
  assert.equal(manualScene(stepFrame(15, 42)).feedbackSent, true);
  assert.equal(manualScene(stepFrame(15, 42)).composing, false);
});
test("copy toast expires and seeking backwards restores initial state", () => {
  assert.equal(manualScene(stepFrame(1, 35)).copied, true);
  assert.equal(manualScene(stepFrame(1, 35) + 54).copied, false);
  const initial = manualScene(0);
  manualScene(DURATION - 1);
  assert.deepEqual(manualScene(0), initial);
});
test("variable scenes cover every frame and preserve toast across cuts", () => {
  for (let step = 0; step < STEP_STARTS.length; step++) {
    assert.equal(manualScene(STEP_STARTS[step]).step, step);
    assert.equal(manualScene(STEP_STARTS[step] + STEP_LENGTHS[step] - 1).step, step);
  }
  assert.equal(manualScene(STEP_STARTS[2]).copied, true);
  assert.equal(manualScene(stepFrame(15, 41)).feedbackSent, false);
});

test("second reply is copied, appended to the file, then saved", () => {
  assert.equal(manualScene(stepFrame(18, 40)).copied, true);
  assert.equal(manualScene(stepFrame(19)).finalPasted, false);
  assert.equal(manualScene(stepFrame(20, 35) - 1).finalPasted, false);
  assert.equal(manualScene(stepFrame(20, 35)).finalPasted, true);
  assert.equal(manualScene(stepFrame(20, 35)).finalSaved, false);
  assert.equal(manualScene(stepFrame(21, 35)).finalSaved, true);
  assert.equal(manualScene(DURATION - 1).fileActive, true);
});
