import assert from "node:assert/strict";
import test from "node:test";
import { buildStats, dayKey, mistakeSounds, reviewSentences } from "../js/stats.js";

test("stats keep a streak and count unique sentences per day", () => {
  const now = new Date(2026, 10, 16, 9, 0, 0);
  const progress = {
    sentences: {
      "ja-1-01": {
        bestScore: 50,
        attempts: [
          { at: new Date(2026, 10, 16, 8).toISOString(), score: 50, recognized: "x", source: "recognition" },
          { at: new Date(2026, 10, 16, 8, 5).toISOString(), score: 80, recognized: "y", source: "recognition" },
          { at: new Date(2026, 10, 15, 8).toISOString(), score: 70, recognized: "", source: "manual" },
        ],
      },
      "en-1-01": {
        bestScore: 40,
        attempts: [{ at: new Date(2026, 10, 14, 8).toISOString(), score: 40, recognized: "light", source: "recognition" }],
      },
    },
  };
  const stats = buildStats(progress, now);
  assert.equal(dayKey(now), "2026-11-16");
  assert.equal(stats.todayCount, 1);
  assert.equal(stats.streak, 3);
  assert.equal(stats.weekTotal, 3);
  const review = reviewSentences(progress);
  assert.equal(review[0].sentence.id, "en-1-01");
  assert.ok(review.every((row) => row.bestScore < 90));
});

test("mistake sounds come from stored recognition text", () => {
  const progress = {
    sentences: {
      "ja-4-01": {
        bestScore: 80,
        attempts: [{ at: new Date().toISOString(), score: 80, recognized: "がこうはあっちです", source: "recognition" }],
      },
    },
  };
  const sounds = mistakeSounds(progress);
  assert.ok(sounds.some((sound) => sound.label.includes("っ")));
});
