const RECORDER_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/mpeg"];

export function clampSpeed(speed) {
  const value = Number(speed);
  if (!Number.isFinite(value)) return 0.8;
  const stepped = Math.round(value * 10) / 10;
  return Math.min(1, Math.max(0.6, stepped));
}

export function getRecognitionCtor(scope) {
  if (!scope) return null;
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function recognitionErrorMessage(code) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "마이크 사용이 허용되지 않았습니다. 브라우저 설정에서 마이크를 켜 주세요.";
    case "no-speech":
      return "음성이 들리지 않았습니다. 다시 한번 또렷하게 말해 보세요.";
    case "audio-capture":
      return "마이크를 찾지 못했습니다. 기기의 마이크 연결을 확인해 주세요.";
    case "network":
      return "음성 인식 연결에 실패했습니다. 녹음으로 비교하거나, 잠시 후 다시 시도해 주세요.";
    case "aborted":
      return "";
    default:
      return "음성 인식 중 문제가 생겼습니다. 녹음으로 비교할 수 있습니다.";
  }
}

export function micErrorMessage(error) {
  const name = error?.name || error?.code || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "not-allowed") {
    return "마이크 권한이 없습니다. 브라우저 설정에서 마이크를 허용해 주세요.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "마이크를 찾지 못했습니다.";
  }
  if (name === "unsupported" || name === "SecurityError") {
    return "이 브라우저에서는 녹음을 시작할 수 없습니다. 듣기와 스스로 평가는 계속할 수 있습니다.";
  }
  return "녹음을 시작하지 못했습니다. 마이크 권한을 확인한 뒤 다시 시도해 주세요.";
}

export function pickVoice(voices, lang) {
  const wanted = String(lang || "").toLowerCase();
  const prefix = wanted.slice(0, 2);
  const ranked = [];
  for (const voice of voices || []) {
    const voiceLang = String(voice?.lang || "").toLowerCase().replace(/_/g, "-");
    let score = -1;
    if (voiceLang === wanted) score = 50;
    else if (prefix && voiceLang.startsWith(prefix)) score = 20;
    if (score < 0) continue;
    const name = String(voice?.name || "");
    if (/google/i.test(name)) score += 30;
    if (prefix === "ja" && /kyoko|nanami|otoya|haruka|日本語/i.test(name)) score += 18;
    if (prefix === "en" && /en-us|us english|samantha|aria|jenny|guy/i.test(`${name} ${voiceLang}`)) score += 12;
    if (voice?.localService) score += 4;
    if (/espeak|compact/i.test(name)) score -= 6;
    ranked.push({ voice, score });
  }
  ranked.sort((a, b) => b.score - a.score || String(a.voice.name).localeCompare(String(b.voice.name)));
  return ranked[0]?.voice || null;
}

export function speak({ synth, Utterance, text, lang, rate, voice, onend, onerror }) {
  const Ctor = Utterance || globalThis.SpeechSynthesisUtterance;
  if (!synth || typeof synth.speak !== "function" || typeof Ctor !== "function") {
    return { ok: false, reason: "unsupported" };
  }
  if (synth.speaking || synth.pending) {
    try { synth.cancel(); } catch { /* already idle */ }
  }
  const utterance = new Ctor(text);
  utterance.lang = lang;
  utterance.rate = clampSpeed(rate);
  if (voice) utterance.voice = voice;
  if (onend) utterance.onend = onend;
  if (onerror) utterance.onerror = onerror;
  try { synth.resume?.(); } catch { /* resume is optional */ }
  synth.speak(utterance);
  return {
    ok: true,
    utterance,
    cancel() {
      try { synth.cancel(); } catch { /* ignore */ }
    },
  };
}

export function runRecognition({ Recognition, lang, onPartial, onFinal, onError, onEnd }) {
  if (typeof Recognition !== "function") return { ok: false, reason: "unsupported" };
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let finalText = "";
  let interim = "";
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    const text = `${finalText} ${interim}`.replace(/\s+/g, " ").trim();
    if (text) onFinal?.(text);
    onEnd?.();
  };
  recognition.addEventListener("result", (event) => {
    let nextFinal = "";
    let nextInterim = "";
    const results = event.results || [];
    for (let index = 0; index < results.length; index += 1) {
      const piece = results[index]?.[0]?.transcript || "";
      if (results[index].isFinal) nextFinal += piece;
      else nextInterim += piece;
    }
    finalText = nextFinal.trim();
    interim = nextInterim.trim();
    const live = `${finalText} ${interim}`.replace(/\s+/g, " ").trim();
    if (live) onPartial?.(live);
  });
  recognition.addEventListener("error", (event) => {
    onError?.(event?.error || "unknown");
  });
  recognition.addEventListener("end", finish);
  try {
    recognition.start();
  } catch (error) {
    return { ok: false, reason: "failed", error };
  }
  return {
    ok: true,
    stop() {
      try { recognition.stop(); } catch { finish(); }
    },
    abort() {
      settled = true;
      try { recognition.abort(); } catch { /* ignore */ }
    },
  };
}

export function pickRecorderMime(isTypeSupported) {
  if (typeof isTypeSupported !== "function") return "";
  return RECORDER_TYPES.find((type) => {
    try { return Boolean(isTypeSupported(type)); } catch { return false; }
  }) || "";
}

export function fileExtension(mime) {
  const value = String(mime || "").toLowerCase();
  if (value.includes("mp4") || value.includes("m4a") || value.includes("aac")) return "m4a";
  if (value.includes("mpeg") || value.includes("mp3")) return "mp3";
  if (value.includes("wav")) return "wav";
  if (value.includes("ogg")) return "ogg";
  return "webm";
}

export function startMediaRecorder(MediaRecorderImpl, stream, mimeType) {
  if (typeof MediaRecorderImpl !== "function") {
    const error = new Error("unsupported");
    error.code = "unsupported";
    throw error;
  }
  let recorder;
  try {
    recorder = mimeType ? new MediaRecorderImpl(stream, { mimeType }) : new MediaRecorderImpl(stream);
  } catch {
    recorder = new MediaRecorderImpl(stream);
  }
  const chunks = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  });
  recorder.start();
  return {
    stop() {
      return new Promise((resolve, reject) => {
        const pack = () => {
          const type = recorder.mimeType || mimeType || "audio/webm";
          resolve({ blob: new Blob(chunks, { type }), mimeType: type });
        };
        if (recorder.state === "inactive") {
          pack();
          return;
        }
        recorder.addEventListener("stop", pack, { once: true });
        recorder.addEventListener("error", () => reject(new Error("record-failed")), { once: true });
        try { recorder.stop(); } catch (error) { reject(error); }
      });
    },
  };
}

export async function openMic(mediaDevices) {
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
    const error = new Error("unsupported");
    error.name = "unsupported";
    throw error;
  }
  return mediaDevices.getUserMedia({ audio: true });
}
