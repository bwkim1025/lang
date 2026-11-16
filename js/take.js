import { runRecognition, startMediaRecorder } from "./speech.js";

export const MAX_TAKE_MS = 7000;
export const SETTLE_MS = 2500;
export const RECORDER_STOP_MS = 1200;

export function isIosDevice(nav = globalThis.navigator) {
  const ua = nav?.userAgent || "";
  const platform = nav?.platform || "";
  const touch = nav?.maxTouchPoints || 0;
  return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && touch > 1);
}

function waitFor(predicate, ms) {
  return new Promise((resolve) => {
    if (predicate()) {
      resolve();
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate() || Date.now() - started >= ms) {
        clearInterval(timer);
        resolve();
      }
    }, 30);
  });
}

function stopTracks(stream) {
  try { stream?.getTracks?.().forEach((track) => track.stop()); } catch { /* ignore */ }
}

async function stopRecorder(handle, timeoutMs) {
  if (!handle) return null;
  let timer = 0;
  const timed = new Promise((resolve) => {
    timer = setTimeout(() => {
      try { handle.requestData(); } catch { /* ignore */ }
      resolve(handle.snapshot?.() || null);
    }, timeoutMs);
  });
  try {
    const clip = await Promise.race([
      handle.stop().catch(() => handle.snapshot?.() || null),
      timed,
    ]);
    clearTimeout(timer);
    return clip || handle.snapshot?.() || null;
  } catch {
    clearTimeout(timer);
    return handle.snapshot?.() || null;
  }
}

export function createTake({
  Recognition = null,
  lang = "ja-JP",
  continuous = false,
  wantRecording = true,
  openMic = null,
  MediaRecorder = null,
  isTypeSupported = null,
  maxMs = MAX_TAKE_MS,
  settleMs = SETTLE_MS,
  recorderStopMs = RECORDER_STOP_MS,
}) {
  let phase = "idle";
  let finalText = "";
  let interim = "";
  let error = "";
  let micError = null;
  let ended = false;
  let ignored = false;
  let finishStarted = false;
  let finishPromise = null;
  let resolveFinished = () => {};
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  let maxTimer = 0;
  let recHandle = null;
  let recorder = null;
  let stream = null;
  const phaseListeners = new Set();

  function setPhase(next) {
    phase = next;
    phaseListeners.forEach((listener) => listener(next));
  }

  async function requestFinish(reason) {
    if (finishPromise) return finishPromise;
    finishStarted = true;
    finishPromise = (async () => {
      clearTimeout(maxTimer);
      if (phase !== "done") setPhase("processing");
      try { recHandle?.stop(); } catch { /* ignore */ }
      await waitFor(() => ended || !recHandle?.ok, settleMs);
      try { recHandle?.abort(); } catch { /* ignore */ }
      const clip = await stopRecorder(recorder, recorderStopMs);
      stopTracks(stream);
      stream = null;
      recorder = null;
      setPhase("done");
      const outcome = {
        reason,
        ignored,
        finalText: `${finalText || interim}`.replace(/\s+/g, " ").trim(),
        error,
        micError,
        clip,
      };
      resolveFinished(outcome);
      return outcome;
    })();
    return finishPromise;
  }

  return {
    get phase() { return phase; },
    onPhase(listener) { phaseListeners.add(listener); },
    start() {
      setPhase("recording");
      if (typeof Recognition === "function") {
        recHandle = runRecognition({
          Recognition,
          lang,
          continuous,
          onPartial: (text) => { interim = text; },
          onFinal: (text) => { finalText = text; },
          onError: (code) => {
            if (!code || code === "aborted") return;
            error = code;
            requestFinish("error");
          },
          onEnd: () => {
            ended = true;
            if (!finishStarted) requestFinish("end");
          },
        });
        if (!recHandle.ok) error = error || "start-failed";
      }
      if (wantRecording && openMic && !finishStarted) {
        openMic().then((nextStream) => {
          if (finishStarted || ignored) {
            stopTracks(nextStream);
            return;
          }
          stream = nextStream;
          try {
            recorder = startMediaRecorder(MediaRecorder, nextStream, isTypeSupported ? pickMime(isTypeSupported) : "");
            if (finishStarted || ignored) {
              stopRecorder(recorder, recorderStopMs);
              stopTracks(nextStream);
              recorder = null;
              stream = null;
            }
          } catch (startError) {
            micError = startError;
            stopTracks(nextStream);
            stream = null;
          }
        }).catch((openError) => {
          micError = openError;
        });
      }
      if (!finishStarted) maxTimer = setTimeout(() => { requestFinish("max"); }, maxMs);
      if (!Recognition && !wantRecording) requestFinish("empty");
    },
    finished,
    stop() { return requestFinish("stop"); },
    cancel() {
      ignored = true;
      return requestFinish("cancel");
    },
  };
}

function pickMime(isTypeSupported) {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  return types.find((type) => {
    try { return isTypeSupported(type); } catch { return false; }
  }) || "";
}
