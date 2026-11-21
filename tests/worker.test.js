import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const scope = "https://practice.example/lang/";

test("activation preserves caches for other apps on the same origin", async () => {
  const keys = new Set(["study-v3", "pronounce-shell-v4"]);
  const handlers = {};
  const caches = {
    async keys() { return [...keys]; },
    async open(name) {
      keys.add(name);
      return { async addAll() {} };
    },
    async delete(name) { return keys.delete(name); },
  };
  const self = {
    registration: { scope },
    addEventListener(name, fn) { handlers[name] = fn; },
    clients: { async claim() {} },
    skipWaiting() {},
  };
  runInNewContext(source, { self, caches, URL });
  async function run(name) {
    let promise;
    handlers[name]({ waitUntil(value) { promise = value; } });
    await promise;
  }
  await run("install");
  await run("activate");
  assert.ok(keys.has("study-v3"));
  assert.ok(!keys.has("pronounce-shell-v4"));
  assert.equal(keys.size, 2);
  handlers.fetch({
    request: new Request("https://practice.example/study/archive"),
    respondWith() { assert.fail("sibling app should bypass the practice worker"); },
  });
});
