import assert from "node:assert/strict";
import test from "node:test";
import { TRACKS } from "../js/data.js";
import { alignUnits, evaluateAttempt } from "../js/diff.js";
import { kataToHira, normalizeKana } from "../js/kana.js";

function findSentence(id) {
  for (const track of TRACKS) {
    for (const lesson of track.lessons) {
      const sentence = lesson.sentences.find((item) => item.id === id);
      if (sentence) return sentence;
    }
  }
  throw new Error(id);
}

function surface(sentence) {
  return sentence.tokens.map((token) => token.t).join("");
}

test("katakana folds into hiragana and punctuation is ignored", () => {
  assert.equal(kataToHira("コーヒー"), "こーひー");
  assert.equal(normalizeKana("これは、医者です！"), "これは医者です");
  assert.equal(normalizeKana("がっこう"), "がっこう");
});

test("alignment prefers a substitution over a delete-insert pair", () => {
  const { ops, distance } = alignUnits(["light"], ["right"]);
  assert.equal(distance, 1);
  assert.deepEqual(ops.map((op) => op.type), ["sub"]);
});

test("japanese kanji, kana, and punctuation all score as the same sentence", () => {
  const sentence = findSentence("ja-1-01");
  const kanji = evaluateAttempt(sentence, surface(sentence));
  const kana = evaluateAttempt(sentence, "わたしはいしゃです");
  const noisy = evaluateAttempt(sentence, "わたしは、いしゃです！");
  assert.equal(kanji.score, 100);
  assert.equal(kana.score, 100);
  assert.equal(noisy.score, 100);
  assert.equal(kanji.hints.length, 0);
  assert.ok(kanji.targetPieces.filter((piece) => piece.ruby).every((piece) => piece.status === "ok"));
});

test("a missing small tsu is marked and explained in Korean", () => {
  const sentence = findSentence("ja-4-01");
  const exact = evaluateAttempt(sentence, "がっこうはあっちです");
  const dropped = evaluateAttempt(sentence, "がこうはあっちです");
  assert.equal(exact.score, 100);
  assert.ok(dropped.score < 100);
  const school = dropped.targetPieces.find((piece) => piece.text === "学校");
  assert.equal(school.status, "miss");
  assert.ok(dropped.hints.some((hint) => hint.includes("っ")));
  assert.ok(dropped.hints.every((hint) => /[가-힣]/.test(hint)));
});

test("katakana coffee order matches the kana reading", () => {
  const sentence = findSentence("ja-2-02");
  const result = evaluateAttempt(sentence, "コーヒーを一杯ください。");
  assert.equal(result.score, 100);
});

test("an empty or unrelated japanese attempt does not pretend to match", () => {
  const sentence = findSentence("ja-1-01");
  const empty = evaluateAttempt(sentence, "  。！ ");
  const far = evaluateAttempt(sentence, "さようなら");
  assert.equal(empty.score, 0);
  assert.match(empty.hints[0], /없습니다/);
  assert.ok(far.score < 45);
  assert.match(far.hints[0], /많이 다릅니다/);
});

test("english comparison ignores case and punctuation", () => {
  const sentence = findSentence("en-1-01");
  const exact = evaluateAttempt(sentence, "RIGHT, THE LIGHT IS RED.");
  const swapped = evaluateAttempt(sentence, "Write the light is red");
  assert.equal(exact.score, 100);
  assert.equal(exact.unitName, "단어");
  assert.ok(swapped.score < 100);
  const right = swapped.targetPieces.find((piece) => piece.text === "Right");
  const light = swapped.targetPieces.find((piece) => piece.text === "light");
  assert.equal(right.status, "miss");
  assert.equal(light.status, "ok");
  assert.match(swapped.hints.join(" "), /혀/);
});

test("english contraction stays one word", () => {
  const sentence = findSentence("en-3-07");
  const result = evaluateAttempt(sentence, "I have never felt a fever");
  const contraction = result.targetPieces.find((piece) => piece.text === "I've");
  assert.equal(contraction.status, "miss");
  assert.match(result.hints.join(" "), /I've|V/);
});
