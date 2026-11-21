import assert from "node:assert/strict";
import test from "node:test";
import { createTake } from "../js/take.js";

class ResultEvent extends Event {
  constructor(results) {
    super("result");
    this.results = results;
  }
}

class SilentRecognition extends EventTarget {
  start() { this.started = true; }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
}

class ErrorRecognition extends EventTarget {
  start() {
    const error = new Event("error");
    error.error = "no-speech";
    this.dispatchEvent(error);
  }
  stop() {}
  abort() { this.aborted = true; }
}

class OkayRecognition extends EventTarget {
  start() {
    const item = [{ transcript: "わたしは いしゃです" }];
    item.isFinal = true;
    this.dispatchEvent(new ResultEvent([item]));
    this.dispatchEvent(new Event("end"));
  }
  stop() { this.dispatchEvent(new Event("end")); }
  abort() {}
}

class HangingRecorder extends EventTarget {
  constructor() {
    super();
    this.state = "inactive";
    this.mimeType = "audio/webm";
  }
  start() { this.state = "recording"; }
  stop() { this.stopped = true; }
  requestData() {
    const chunk = new Event("dataavailable");
    chunk.data = new Blob(["audio"], { type: "audio/webm" });
    this.dispatchEvent(chunk);
  }
}

test("stop finishes when recognition never returns a result or end event", async () => {
  const take = createTake({
    Recognition: SilentRecognition,
    lang: "ja-JP",
    wantRecording: false,
    settleMs: 40,
    maxMs: 5000,
  });
  take.start();
  assert.equal(take.phase, "recording");
  const result = await take.stop();
  assert.equal(result.reason, "stop");
  assert.equal(result.finalText, "");
  assert.equal(take.phase, "done");
});

test("a recognition error ends the take instead of leaving it listening", async () => {
  const take = createTake({
    Recognition: ErrorRecognition,
    lang: "ja-JP",
    wantRecording: false,
    settleMs: 200,
    maxMs: 5000,
  });
  const result = await new Promise((resolve) => {
    const original = take.finished.then(resolve);
    void original;
    take.start();
  });
  assert.equal(result.error, "no-speech");
  assert.equal(result.finalText, "");
  assert.equal(take.phase, "done");
});

test("a successful transcript is kept when recognition ends", async () => {
  const take = createTake({
    Recognition: OkayRecognition,
    lang: "ja-JP",
    wantRecording: false,
    settleMs: 50,
    maxMs: 5000,
  });
  const result = await new Promise((resolve) => {
    take.finished.then(resolve);
    take.start();
  });
  assert.equal(result.finalText, "わたしは いしゃです");
  assert.equal(take.phase, "done");
});

test("a recorder that never stops still releases the take", async () => {
  const take = createTake({
    Recognition: null,
    wantRecording: true,
    openMic: async () => ({ getTracks: () => [{ stop() {} }] }),
    MediaRecorder: HangingRecorder,
    isTypeSupported: () => false,
    settleMs: 20,
    recorderStopMs: 30,
    maxMs: 5000,
  });
  take.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const result = await take.stop();
  assert.equal(take.phase, "done");
  assert.equal(result.finalText, "");
  assert.ok(result.clip?.blob?.size > 0);
});

test("recording-only time starts after permission arrives", async () => {
  let grant;
  let released = false;
  const take = createTake({
    openMic: () => new Promise((resolve) => { grant = resolve; }),
    MediaRecorder: HangingRecorder,
    maxMs: 25,
    recorderStopMs: 10,
  });
  take.start();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(take.phase, "preparing");
  grant({ getTracks: () => [{ stop() { released = true; } }] });
  const result = await take.finished;
  assert.equal(result.reason, "max");
  assert.ok(result.clip?.blob.size);
  assert.equal(released, true);
});

test("denial ends a recording-only attempt and delayed permission after cancel releases the mic", async () => {
  const denied = new Error("permission denied");
  const take = createTake({ openMic: async () => { throw denied; } });
  take.start();
  const result = await take.finished;
  assert.equal(result.reason, "error");
  assert.equal(result.micError, denied);

  let grant;
  let released = false;
  const pending = createTake({ openMic: () => new Promise((resolve) => { grant = resolve; }) });
  pending.start();
  const cancelled = await pending.cancel();
  grant({ getTracks: () => [{ stop() { released = true; } }] });
  await Promise.resolve();
  assert.equal(cancelled.ignored, true);
  assert.equal(released, true);
});
