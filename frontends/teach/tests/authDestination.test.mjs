import { test } from "node:test";
import assert from "node:assert/strict";
import { isTalentDestination, loginDestination } from "../src/auth/destination.ts";

test("login returns to each challenge and the selected leaderboard", () => {
  for (const next of ["/talent", "/talent/leaderboard", ...["reaction", "memory", "reasoning", "focus"].flatMap(game => [`/talent/${game}`, `/talent/leaderboard?game=${game}`])]) {
    assert.equal(loginDestination(next), next);
    assert.equal(isTalentDestination(loginDestination(next)), true);
  }
  for (const next of ["/leaderboard", "/lessons/agent-loop"]) {
    assert.equal(loginDestination(next), next);
    assert.equal(isTalentDestination(loginDestination(next)), false);
  }
});

test("unrecognized and external destinations cannot become login redirects", () => {
  for (const next of [null, "", "https://evil.example/talent", "//evil.example", "/\\evil.example", "/talented", "/talent/../", "/talent/unknown", "/talent/reaction/", "/talent/reaction\n", "/talent/leaderboard?game=unknown", "/talent/leaderboard?game=focus&next=//evil.example", "/talent/leaderboard?game=focus#other"]) {
    assert.equal(loginDestination(next), "/");
    assert.equal(isTalentDestination(loginDestination(next)), false);
  }
});
