import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTEMPT_LIMIT,
  LEGACY_KEYS,
  STORAGE_KEY,
  emptyProgress,
  loadProgress,
  recordAttempt,
  saveProgress,
  summarize,
} from "../js/storage.js";

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  const calls = [];
  return {
    calls,
    getItem(key) {
      calls.push(["get", key]);
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      calls.push(["set", key]);
      map.set(key, String(value));
    },
    removeItem(key) {
      calls.push(["remove", key]);
      map.delete(key);
    },
  };
}

test("versioned key is stable and legacy keys are not removed", () => {
  assert.equal(STORAGE_KEY, "pronounce.progress.v1");
  assert.ok(LEGACY_KEYS.includes("pronounce.progress.v0"));
  const legacy = {
    version: 0,
    speed: 0.7,
    current: { trackId: "ja", lessonId: "ja-1", index: 2 },
    sentences: { "ja-1-01": { bestScore: 80, attempts: [{ score: 80 }] } },
    customFlag: true,
  };
  const storage = memoryStorage({ "pronounce.progress.v0": JSON.stringify(legacy) });
  const loaded = loadProgress(storage);
  assert.equal(loaded.customFlag, true);
  assert.equal(loaded.speed, 0.7);
  assert.equal(loaded.sentences["ja-1-01"].bestScore, 80);
  assert.equal(storage.getItem("pronounce.progress.v0"), JSON.stringify(legacy));
  assert.ok(storage.getItem(STORAGE_KEY));
  saveProgress(storage, loaded);
  assert.equal(storage.calls.some((call) => call[0] === "remove"), false);
  assert.equal(storage.getItem("pronounce.progress.v0"), JSON.stringify(legacy));
});

test("an existing v1 record is not replaced by older data", () => {
  const current = { version: 1, speed: 1, current: null, sentences: {}, keep: "yes" };
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify(current),
    "pronounce.progress.v0": JSON.stringify({ speed: 0.6, customFlag: true }),
  });
  const loaded = loadProgress(storage);
  assert.equal(loaded.keep, "yes");
  assert.equal(loaded.speed, 1);
  assert.equal(storage.calls.some((call) => call[0] === "set"), false);
});

test("a corrupt v1 value is not overwritten on load", () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: "{not json",
    "pronounce.progress.v0": JSON.stringify({ speed: 0.6, note: "old" }),
  });
  const loaded = loadProgress(storage);
  assert.equal(loaded.speed, 0.8);
  assert.equal(storage.getItem(STORAGE_KEY), "{not json");
  assert.equal(storage.calls.some((call) => call[0] === "set"), false);
});

test("attempts keep the all-time best and only the latest few", () => {
  let progress = emptyProgress();
  progress.customFlag = true;
  for (let index = 0; index < ATTEMPT_LIMIT + 1; index += 1) {
    progress = recordAttempt(progress, "ja-1-01", {
      at: String(index),
      score: index === 0 ? 99 : 10 + index,
      recognized: "x".repeat(20),
      source: "recognition",
    });
  }
  progress.sentences["ja-1-01"].tutorNote = "keep";
  progress = recordAttempt(progress, "ja-1-01", {
    at: "later",
    score: 40,
    recognized: "",
    source: "manual",
  });
  const record = progress.sentences["ja-1-01"];
  assert.equal(progress.customFlag, true);
  assert.equal(record.tutorNote, "keep");
  assert.equal(record.attempts.length, ATTEMPT_LIMIT);
  assert.equal(record.bestScore, 99);
  assert.equal(record.attempts.at(-1).source, "manual");
  assert.equal(record.attempts.some((attempt) => attempt.score === 99), false);
});

test("summary counts practice without dropping unrelated sentences", () => {
  const progress = recordAttempt(emptyProgress(), "a", {
    at: "1",
    score: 80,
    recognized: "a",
    source: "recognition",
  });
  const stats = summarize(["a", "b"], progress);
  assert.deepEqual(stats, { practiced: 1, total: 2, average: 80, mastered: 1 });
});
