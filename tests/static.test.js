import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TRACKS, neighborSentence } from "../js/data.js";
import { normalizeKana } from "../js/kana.js";
import { parseHash, practiceHash } from "../js/route.js";

const root = new URL("..", import.meta.url);

test("routes stay inside the static site", () => {
  assert.deepEqual(parseHash(""), { name: "home" });
  assert.deepEqual(parseHash("#/"), { name: "home" });
  assert.deepEqual(parseHash("#/track/ja"), { name: "lessons", trackId: "ja", lessonId: null });
  assert.deepEqual(parseHash("#/stats"), { name: "stats" });
  assert.deepEqual(parseHash("#/practice/en/en-3/4"), {
    name: "practice",
    trackId: "en",
    lessonId: "en-3",
    index: 4,
  });
  assert.equal(parseHash("#/nope").name, "home");
  assert.equal(practiceHash("ja", "ja-1", 2), "#/practice/ja/ja-1/2");
});

test("each track has five lessons of eight sentences", () => {
  assert.deepEqual(TRACKS.map((track) => track.id), ["ja", "en"]);
  assert.deepEqual(TRACKS.map((track) => track.lang), ["ja-JP", "en-US"]);
  const ids = new Set();
  for (const track of TRACKS) {
    assert.equal(track.lessons.length, 5);
    track.lessons.forEach((lesson, index) => {
      assert.equal(lesson.level, index + 1);
      assert.equal(lesson.sentences.length, 8);
      assert.match(lesson.title, /[가-힣]/);
      assert.match(lesson.summary, /[가-힣]/);
      for (const sentence of lesson.sentences) {
        assert.equal(ids.has(sentence.id), false);
        ids.add(sentence.id);
        assert.ok(sentence.id.startsWith(`${lesson.id}-`));
        assert.match(sentence.meaning, /[가-힣]/);
        assert.match(sentence.tip, /[가-힣]/);
        if (track.id === "ja") {
          assert.ok(sentence.tokens.length > 0);
          for (const token of sentence.tokens) {
            assert.match(normalizeKana(token.r), /^[\u3040-\u30ff]*$/);
          }
        } else {
          assert.ok(sentence.text.split(/\s+/).length >= 3);
          for (const [key, hint] of Object.entries(sentence.hints)) {
            assert.equal(key, key.toLowerCase());
            assert.ok(sentence.text.toLowerCase().includes(key), `${sentence.id} ${key}`);
            assert.match(hint, /[가-힣]/);
          }
        }
      }
    });
  }
  assert.equal(ids.size, 80);
});

test("sentence navigation stays inside the track", () => {
  const japanese = TRACKS[0];
  assert.deepEqual(neighborSentence(japanese, "ja-1", 7, 1), { lessonId: "ja-2", index: 0 });
  assert.deepEqual(neighborSentence(japanese, "ja-2", 0, -1), { lessonId: "ja-1", index: 7 });
  assert.equal(neighborSentence(japanese, "ja-1", 0, -1), null);
  assert.equal(neighborSentence(japanese, "ja-5", 7, 1), null);
});

test("the shell is a root-relative PWA", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", root), "utf8"));
  const worker = readFileSync(new URL("sw.js", root), "utf8");
  const app = readFileSync(new URL("js/app.js", root), "utf8");
  assert.match(html, /lang="ko"/);
  assert.match(html, /발음 연습/);
  assert.match(html, /src="\.\/js\/app\.js"/);
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.match(manifest.name, /발음/);
  assert.match(worker, /const CACHE = "pronounce-shell-v\d+"/);
  const assets = [...worker.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1]);
  assert.ok(assets.includes("./index.html"));
  assert.ok(assets.includes("./fonts/gothic-a1-korean-400.woff2"));
  assert.ok(assets.includes("./fonts/NotoSansJP-Regular.woff2"));
  assert.ok(assets.includes("./fonts/NotoSansJP-Regular.woff2"));
  for (const asset of assets) {
    if (asset === "./") continue;
    readFileSync(new URL(asset.slice(2), root));
  }
  assert.match(app, /음성 인식이 안 돼요/);
  assert.doesNotMatch(app, /lorem ipsum/i);
});
