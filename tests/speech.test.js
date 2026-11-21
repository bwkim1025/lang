import assert from "node:assert/strict";
import test from "node:test";
import {
  clampSpeed,
  fileExtension,
  getRecognitionCtor,
  micErrorMessage,
  pickRecorderMime,
  pickVoice,
  recognitionErrorMessage,
  runRecognition,
  speak,
  startMediaRecorder,
} from "../js/speech.js";

class ResultEvent extends Event {
  constructor(results) {
    super("result");
    this.results = results;
  }
}

class MockRecognition extends EventTarget {
  constructor() {
    super();
    this.lang = "";
    this.interimResults = false;
    this.continuous = true;
    this.maxAlternatives = 3;
  }

  start() {
    this.seen = {
      lang: this.lang,
      interimResults: this.interimResults,
      continuous: this.continuous,
      maxAlternatives: this.maxAlternatives,
    };
    const finalItem = [{ transcript: "わたしはいしゃです" }];
    finalItem.isFinal = true;
    this.dispatchEvent(new ResultEvent([finalItem]));
    this.dispatchEvent(new Event("end"));
  }

  stop() {
    this.dispatchEvent(new Event("end"));
  }

  abort() {
    this.aborted = true;
  }
}

test("recognition uses the requested language and returns the final transcript", () => {
  let finalText = "";
  let ended = 0;
  const handle = runRecognition({
    Recognition: MockRecognition,
    lang: "ja-JP",
    onFinal: (text) => { finalText = text; },
    onEnd: () => { ended += 1; },
  });
  assert.equal(handle.ok, true);
  assert.equal(finalText, "わたしはいしゃです");
  assert.equal(ended, 1);
});

test("an interim result is kept when the browser never marks it final", () => {
  class InterimOnly extends MockRecognition {
    start() {
      const item = [{ transcript: "right the light" }];
      item.isFinal = false;
      this.dispatchEvent(new ResultEvent([item]));
      this.dispatchEvent(new Event("end"));
    }
  }
  let finalText = "";
  runRecognition({
    Recognition: InterimOnly,
    lang: "en-US",
    onFinal: (text) => { finalText = text; },
  });
  assert.equal(finalText, "right the light");
});

test("English recognition chunks preserve the boundary between words", () => {
  class MultipleResults extends MockRecognition {
    start() {
      const chunks = ["Turn", "right"].map((transcript) => {
        const item = [{ transcript }];
        item.isFinal = true;
        return item;
      });
      this.dispatchEvent(new ResultEvent(chunks));
      this.dispatchEvent(new Event("end"));
    }
  }
  let finalText;
  runRecognition({ Recognition: MultipleResults, lang: "en-US", onFinal: (text) => { finalText = text; } });
  assert.equal(finalText, "Turn right");
});

test("unsupported recognition and error codes stay in Korean", () => {
  const missing = runRecognition({ Recognition: null, lang: "en-US" });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "unsupported");
  assert.equal(getRecognitionCtor({}), null);
  assert.equal(getRecognitionCtor({ webkitSpeechRecognition: MockRecognition }), MockRecognition);
  class NoSpeech extends MockRecognition {
    start() {
      const error = new Event("error");
      error.error = "no-speech";
      this.dispatchEvent(error);
      this.dispatchEvent(new Event("end"));
    }
  }
  let code = "";
  let finalText = "untouched";
  runRecognition({
    Recognition: NoSpeech,
    lang: "ja-JP",
    onError: (value) => { code = value; },
    onFinal: () => { finalText = "called"; },
  });
  assert.equal(code, "no-speech");
  assert.equal(finalText, "untouched");
  assert.match(recognitionErrorMessage("no-speech"), /음성/);
  assert.match(recognitionErrorMessage("not-allowed"), /마이크/);
  assert.equal(recognitionErrorMessage("aborted"), "");
  assert.match(micErrorMessage({ name: "NotAllowedError" }), /권한/);
});

test("the recognizer is configured before it starts", () => {
  let seen = null;
  class Inspect extends MockRecognition {
    start() {
      seen = {
        lang: this.lang,
        interimResults: this.interimResults,
        continuous: this.continuous,
        maxAlternatives: this.maxAlternatives,
      };
      this.dispatchEvent(new Event("end"));
    }
  }
  runRecognition({ Recognition: Inspect, lang: "en-US" });
  assert.deepEqual(seen, {
    lang: "en-US",
    interimResults: true,
    continuous: false,
    maxAlternatives: 1,
  });
});

test("voice choice prefers a matching Google voice", () => {
  const voices = [
    { name: "Yuna", lang: "ko-KR" },
    { name: "Samantha", lang: "en-US", localService: true },
    { name: "Google US English", lang: "en-US" },
    { name: "Kyoko", lang: "ja-JP", localService: true },
    { name: "Google 日本語", lang: "ja-JP" },
  ];
  assert.equal(pickVoice(voices, "ja-JP").name, "Google 日本語");
  assert.equal(pickVoice(voices, "en-US").name, "Google US English");
  assert.equal(pickVoice([{ name: "Yuna", lang: "ko-KR" }], "ja-JP"), null);
});

test("speak sets language and a slow rate", () => {
  const spoken = [];
  const synth = {
    speaking: false,
    speak(utterance) { spoken.push(utterance); },
    cancel() { this.cancelled = true; },
    resume() {},
  };
  class Utterance {
    constructor(text) { this.text = text; }
  }
  const handle = speak({
    synth,
    Utterance,
    text: "私は医者です。",
    lang: "ja-JP",
    rate: 0.64,
  });
  assert.equal(handle.ok, true);
  assert.equal(spoken[0].lang, "ja-JP");
  assert.equal(spoken[0].text, "私は医者です。");
  assert.equal(spoken[0].rate, 0.6);
  assert.equal(clampSpeed(2), 1);
  assert.equal(speak({ synth: null, Utterance, text: "hi", lang: "en-US" }).ok, false);
});

test("recorder collects a clip and picks a supported mime type", async () => {
  class FakeRecorder extends EventTarget {
    constructor(stream, options = {}) {
      super();
      this.stream = stream;
      this.mimeType = options.mimeType || "audio/webm";
      this.state = "inactive";
    }

    start() { this.state = "recording"; }

    stop() {
      this.state = "inactive";
      const chunk = new Event("dataavailable");
      chunk.data = new Blob(["clip"], { type: this.mimeType });
      this.dispatchEvent(chunk);
      this.dispatchEvent(new Event("stop"));
    }
  }
  const handle = startMediaRecorder(FakeRecorder, { id: "mic" }, "audio/mp4");
  const clip = await handle.stop();
  assert.equal(clip.mimeType, "audio/mp4");
  assert.ok(clip.blob.size > 0);
  assert.equal(fileExtension("audio/mp4"), "m4a");
  assert.equal(fileExtension("audio/webm;codecs=opus"), "webm");
  assert.equal(pickRecorderMime((type) => type === "audio/mp4"), "audio/mp4");
  assert.equal(pickRecorderMime(() => false), "");
});
