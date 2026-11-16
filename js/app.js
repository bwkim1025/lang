import { TRACKS, getLesson, getTrack, listSentenceIds, neighborSentence, surfaceText } from "./data.js";
import { evaluateAttempt, scoreLabel } from "./diff.js";
import { parseHash, practiceHash, trackHash } from "./route.js";
import {
  clampSpeed,
  fileExtension,
  getRecognitionCtor,
  micErrorMessage,
  openMic,
  pickRecorderMime,
  pickVoice,
  recognitionErrorMessage,
  runRecognition,
  speak,
  startMediaRecorder,
} from "./speech.js";
import { emptyProgress, loadProgress, recordAttempt, saveProgress, summarize } from "./storage.js";

const RATINGS = [
  { score: 40, label: "어렵습니다" },
  { score: 75, label: "비슷합니다" },
  { score: 100, label: "잘했습니다" },
];

const ui = {
  phase: "idle",
  status: "",
  error: "",
  result: null,
  offerManual: false,
};

let progress = emptyProgress();
let session = null;
let speakHandle = null;
let cancelSpeak = false;
const clips = new Map();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function speedText(speed) {
  const value = clampSpeed(speed);
  const label = value <= 0.7 ? "느리게" : value < 1 ? "조금 느리게" : "보통";
  return `${label} (${value.toFixed(1)}배)`;
}

function supportState() {
  return {
    recognition: Boolean(getRecognitionCtor(window)),
    recording: typeof window.MediaRecorder === "function" && Boolean(navigator.mediaDevices?.getUserMedia),
    secure: window.isSecureContext !== false,
    synthesis: typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance === "function",
  };
}

function announce(text) {
  const live = document.getElementById("live");
  if (live) live.textContent = text || "";
}

function setStatus(text) {
  ui.status = text;
  const node = document.getElementById("status");
  if (node) node.textContent = text;
}

function screenModel() {
  const route = parseHash(location.hash);
  if (route.name === "track") {
    const track = getTrack(route.trackId);
    return track ? { kind: "track", track } : { kind: "missing" };
  }
  if (route.name === "practice") {
    const track = getTrack(route.trackId);
    const lesson = getLesson(track, route.lessonId);
    if (!track || !lesson) return { kind: "missing" };
    const index = Math.min(Math.max(route.index, 0), lesson.sentences.length - 1);
    return { kind: "practice", track, lesson, index, sentence: lesson.sentences[index], route };
  }
  return { kind: "home" };
}

function fixHash() {
  const route = parseHash(location.hash);
  if (route.name !== "practice") return false;
  const track = getTrack(route.trackId);
  const lesson = getLesson(track, route.lessonId);
  if (!track || !lesson) return false;
  const index = Math.min(Math.max(route.index, 0), lesson.sentences.length - 1);
  const next = practiceHash(track.id, lesson.id, index);
  if (location.hash === next) return false;
  location.replace(next);
  return true;
}

function resolveCurrent() {
  const current = progress.current;
  if (!current || typeof current !== "object") return null;
  const track = getTrack(current.trackId);
  const lesson = getLesson(track, current.lessonId);
  if (!track || !lesson) return null;
  const index = Math.min(Math.max(Number(current.index) || 0, 0), lesson.sentences.length - 1);
  return { track, lesson, index };
}

function rememberPosition(track, lesson, index) {
  const current = { trackId: track.id, lessonId: lesson.id, index };
  const prev = progress.current;
  if (prev && prev.trackId === current.trackId && prev.lessonId === current.lessonId && prev.index === current.index) return;
  progress = { ...progress, current };
  persist();
}

function persist() {
  try { progress = saveProgress(localStorage, progress); } catch { /* 저장 공간이 가득 차도 화면은 유지합니다. */ }
}

function markHtml() {
  return `<span class="mark" aria-hidden="true"><span></span><span></span><span></span></span>`;
}

function headerHtml(link) {
  return `<header class="site-header"><div class="wrap bar">
    <a class="brand" href="#/">${markHtml()}<span>발음 연습</span></a>
    ${link ? `<a class="textlink" href="${esc(link.href)}">${esc(link.label)}</a>` : ""}
  </div></header>`;
}

function progressBar(done, total) {
  const width = total ? Math.round((done / total) * 100) : 0;
  return `<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="연습한 문장 ${done}/${total}"><span style="width:${width}%"></span></div>`;
}

function lessonStats(lesson) {
  return summarize(lesson.sentences.map((sentence) => sentence.id), progress);
}

function viewHome() {
  const current = resolveCurrent();
  const continueHtml = current ? `<a class="continue" href="${practiceHash(current.track.id, current.lesson.id, current.index)}">
      <span class="eyebrow">이어서 연습</span>
      <strong>${esc(current.track.title)} · ${esc(current.lesson.title)}</strong>
      <span>문장 ${current.index + 1} / ${current.lesson.sentences.length}</span>
    </a>` : "";
  const cards = TRACKS.map((track) => {
    const stats = summarize(listSentenceIds(track), progress);
    const doneLessons = track.lessons.filter((lesson) => {
      const summary = lessonStats(lesson);
      return summary.total > 0 && summary.mastered === summary.total;
    }).length;
    const average = stats.average == null ? "아직 점수가 없습니다" : `최고 점수 평균 ${stats.average}점`;
    return `<a class="track-card" href="${trackHash(track.id)}">
      <span class="eyebrow">${esc(track.title)}</span>
      <strong>${esc(track.summary)}</strong>
      <span class="meta">${track.lessons.length}개 레슨 · ${stats.total}문장 · 레슨 ${doneLessons}/${track.lessons.length} 완료</span>
      ${progressBar(stats.practiced, stats.total)}
      <span class="meta">연습한 문장 ${stats.practiced}/${stats.total} · ${esc(average)}</span>
    </a>`;
  }).join("");
  return `${headerHtml(null)}
    <main id="main" class="wrap" tabindex="-1" data-screen="home">
      <p class="eyebrow">일본어 · 영어</p>
      <h1>한 문장씩, 소리 내어</h1>
      <p class="lede">모델 음성을 듣고, 따라 말한 뒤, 내 녹음과 비교합니다.</p>
      ${continueHtml}
      <div class="track-grid">${cards}</div>
      <p class="fine">점수는 이 브라우저에만 저장됩니다. 말하기 인식은 브라우저의 음성 인식을 쓰고, 녹음 파일은 기기에만 남습니다. 필요한 녹음은 다운로드해 두세요.</p>
    </main>`;
}

function viewTrack(track) {
  const items = track.lessons.map((lesson) => {
    const stats = lessonStats(lesson);
    const complete = stats.total > 0 && stats.mastered === stats.total;
    const average = stats.average == null ? "아직 연습 전" : `최고 ${stats.average}점`;
    return `<a class="lesson" href="${practiceHash(track.id, lesson.id, 0)}">
      <span class="level">${lesson.level}</span>
      <span class="lesson-body">
        <span class="lesson-title">${esc(lesson.title)}${complete ? `<span class="badge">완료</span>` : ""}</span>
        <span class="lesson-sum">${esc(lesson.summary)}</span>
        <span class="meta">연습 ${stats.practiced}/${stats.total} · ${esc(average)}</span>
      </span>
    </a>`;
  }).join("");
  return `${headerHtml({ href: "#/", label: "처음으로" })}
    <main id="main" class="wrap" tabindex="-1" data-screen="track">
      <p class="eyebrow">레슨</p>
      <h1>${esc(track.title)}</h1>
      <p class="lede">${esc(track.summary)} 레슨은 쉬운 순서입니다.</p>
      <div class="lesson-list">${items}</div>
    </main>`;
}

function viewMissing() {
  return `${headerHtml({ href: "#/", label: "처음으로" })}
    <main id="main" class="wrap" tabindex="-1" data-screen="missing">
      <h1>없는 화면입니다</h1>
      <p class="lede">주소가 바뀌었거나 레슨이 없습니다.</p>
      <a class="btn btn-primary" href="#/">처음으로</a>
    </main>`;
}

function piecesHtml(pieces, { ruby = false, join = "" } = {}) {
  return (pieces || []).map((piece) => {
    const cls = piece.status && piece.status !== "neutral" ? `tok ${piece.status}` : "tok";
    if (ruby && piece.ruby) {
      return `<span class="${cls}"><ruby>${esc(piece.text)}<rt>${esc(piece.reading || "")}</rt></ruby></span>`;
    }
    return `<span class="${cls}">${esc(piece.text)}</span>`;
  }).join(join);
}

function sentenceHtml(sentence, evaluation) {
  const lang = sentence.tokens ? "ja" : "en";
  const cls = sentence.tokens ? "target target-ja" : "target target-en";
  if (evaluation?.targetPieces && !evaluation.manual) {
    return `<p class="${cls}" lang="${lang}" aria-label="${esc(surfaceText(sentence))}">${piecesHtml(evaluation.targetPieces, { ruby: Boolean(sentence.tokens) })}</p>`;
  }
  if (sentence.tokens) {
    const pieces = sentence.tokens.map((token) => ({
      text: token.t,
      reading: token.r,
      ruby: Boolean(token.r) && token.t !== token.r,
      status: "neutral",
    }));
    return `<p class="${cls}" lang="ja" aria-label="${esc(surfaceText(sentence))}">${piecesHtml(pieces, { ruby: true })}</p>`;
  }
  return `<p class="${cls}" lang="en">${esc(sentence.text)}</p>`;
}

function resultHtml(sentence) {
  const result = ui.result?.sentenceId === sentence.id ? ui.result.evaluation : null;
  if (!result) return "";
  const hints = (result.hints || []).map((hint) => `<li>${esc(hint)}</li>`).join("");
  const heard = result.targetPieces && result.heardPieces?.length
    ? `<h3>${result.unitName === "글자" ? "읽기 비교" : "단어 비교"}</h3>
       <p class="heard">${piecesHtml(result.heardPieces, { join: result.heardJoin || "" })}</p>`
    : "";
  const quote = result.recognized
    ? `<h3>브라우저가 들은 말</h3><p class="quote">${esc(result.recognized)}</p>`
    : "";
  const fraction = result.total
    ? `<p class="fraction">맞춘 ${esc(result.unitName)} ${result.matched}/${result.total}</p>`
    : "";
  const legend = result.targetPieces
    ? `<p class="legend">초록은 목표와 같습니다. 주황은 다시 확인할 부분입니다.</p>`
    : "";
  return `<section class="card result" aria-live="polite">
    <div class="scoreline">
      <p class="score"><strong>${esc(result.score)}</strong><span>점</span></p>
      <p class="score-label">${esc(result.label || scoreLabel(result.score))}</p>
    </div>
    ${fraction}
    ${legend}
    ${quote}
    ${heard}
    ${hints ? `<h3>다시 볼 곳</h3><ul class="hints">${hints}</ul>` : `<p class="empty">어긋난 부분이 없습니다.</p>`}
  </section>`;
}

function audioHtml(sentence) {
  const clip = clips.get(sentence.id);
  if (!clip) return "";
  return `<section class="card">
    <h2>나와 모델</h2>
    <p class="meta">내 녹음을 재생한 뒤, 모델 듣기로 바로 비교해 보세요.</p>
    <audio controls playsinline preload="metadata" src="${esc(clip.url)}"></audio>
    <div class="actions">
      <button class="btn" type="button" data-action="model">모델 듣기</button>
      <button class="btn btn-primary" type="button" data-action="download">다운로드</button>
    </div>
    <p class="fine">이 녹음은 새로고침하면 사라집니다. 튜터에게 보내려면 다운로드해 두세요.</p>
  </section>`;
}

function manualHtml(show) {
  if (!show) return "";
  const buttons = RATINGS.map((rating) => (
    `<button class="btn" type="button" data-action="rate" data-score="${rating.score}">${esc(rating.label)}</button>`
  )).join("");
  return `<section class="card">
    <h2>스스로 평가</h2>
    <p class="meta">자동 인식이 없을 때는 직접 점수를 남깁니다. 최근 시도에 쌓입니다.</p>
    <div class="actions ratings">${buttons}</div>
  </section>`;
}

function historyHtml(sentenceId) {
  const record = progress.sentences?.[sentenceId];
  const attempts = Array.isArray(record?.attempts) ? [...record.attempts].reverse() : [];
  const best = typeof record?.bestScore === "number" ? `최고 ${record.bestScore}점` : "아직 점수 없음";
  const list = attempts.length
    ? `<ol class="attempts">${attempts.map((attempt) => `<li>
        <span class="attempt-score">${esc(attempt.score)}점</span>
        <span class="attempt-meta">${esc(attempt.source === "manual" ? "스스로" : "인식")} · ${esc(formatWhen(attempt.at))}</span>
        ${attempt.recognized ? `<span class="attempt-text">${esc(attempt.recognized)}</span>` : ""}
      </li>`).join("")}</ol>`
    : `<p class="empty">아직 이 문장의 기록이 없습니다.</p>`;
  return `<section class="card side-card"><h2>최근 시도</h2><p class="meta">${esc(best)} · 최근 ${attempts.length}개</p>${list}</section>`;
}

function viewPractice(model) {
  const { track, lesson, index, sentence } = model;
  const support = supportState();
  const busy = ui.phase === "listening" || ui.phase === "recording" || ui.phase === "speaking";
  const showManual = !support.recognition || !support.secure || ui.offerManual;
  const evaluation = ui.result?.sentenceId === sentence.id ? ui.result.evaluation : null;
  const record = progress.sentences?.[sentence.id];
  const best = typeof record?.bestScore === "number" ? `<span class="badge">최고 ${record.bestScore}점</span>` : "";
  let banner = "";
  if (!support.secure) {
    banner = `<p class="notice"><strong>보안 연결이 필요합니다</strong>마이크는 보안 주소에서만 쓸 수 있습니다. 듣기는 계속할 수 있습니다.</p>`;
  } else if (!support.recognition) {
    banner = `<p class="notice"><strong>자동 받아쓰기를 쓸 수 없습니다</strong>이 브라우저는 말한 내용을 자동으로 받아 적지 못합니다. 아이폰의 일부 버전이나 앱 안 브라우저에서 흔합니다. 녹음으로 모델과 비교하고, 아래에서 스스로 점수를 남겨 주세요.</p>`;
  }
  const listenLabel = ui.phase === "speaking" ? "멈추기" : "듣기";
  const listenAction = ui.phase === "speaking" ? "stop-speak" : "listen";
  let primary = "";
  if (support.recognition && support.secure) {
    const speakingNow = ui.phase === "listening";
    primary = `<button class="btn btn-primary primary-action" type="button" data-action="${speakingNow ? "stop-listen" : "speak"}" aria-pressed="${speakingNow}">${speakingNow ? "중지" : "말하기"}</button>`;
  } else if (support.recording && support.secure) {
    const recordingNow = ui.phase === "recording";
    primary = `<button class="btn btn-primary primary-action" type="button" data-action="${recordingNow ? "stop-record" : "record"}" aria-pressed="${recordingNow}">${recordingNow ? "중지" : "녹음하기"}</button>`;
  }
  const voice = voiceNote(track.lang);
  const note = support.recognition && support.secure
    ? `<p class="fine">말하기를 누르면 인식과 녹음이 함께 시작됩니다.${support.recording ? "" : " 이 브라우저에서는 녹음 파일을 만들 수 없습니다."}</p>`
    : "";
  const segments = `<div class="segments" aria-hidden="true">${lesson.sentences.map((item, itemIndex) => {
    const done = typeof progress.sentences?.[item.id]?.bestScore === "number";
    const cls = [itemIndex === index ? "now" : "", done ? "done" : ""].filter(Boolean).join(" ");
    return `<span class="${cls}"></span>`;
  }).join("")}</div>`;
  return `${headerHtml({ href: trackHash(track.id), label: "레슨 목록" })}
    <main id="main" class="wrap" tabindex="-1" data-screen="practice">
      <div class="practice-head">
        <p class="eyebrow">${esc(track.title)} · ${esc(lesson.title)}</p>
        <div class="head-row"><h1>문장 ${index + 1} / ${lesson.sentences.length}</h1>${best}</div>
      </div>
      ${banner}
      ${ui.error ? `<p class="error-banner">${esc(ui.error)}</p>` : ""}
      <div class="practice-grid">
        <div class="stack">
          ${segments}
          <article class="card sentence-card">
            ${sentenceHtml(sentence, evaluation)}
            <p class="meaning">${esc(sentence.meaning)}</p>
            ${sentence.tip ? `<p class="tip"><span>발음 포인트</span>${esc(sentence.tip)}</p>` : ""}
            ${lesson.note ? `<p class="limit-note">${esc(lesson.note)}</p>` : ""}
          </article>
          <section class="card">
            <div class="speed">
              <div class="speed-top"><label for="speed">속도</label><span id="speed-label">${esc(speedText(progress.speed))}</span></div>
              <input id="speed" type="range" min="0.6" max="1" step="0.1" value="${esc(clampSpeed(progress.speed))}">
            </div>
            <div class="actions">
              <button class="btn" type="button" data-action="${listenAction}" ${busy && ui.phase !== "speaking" ? "disabled" : ""}>${listenLabel}</button>
              ${primary}
            </div>
            <p id="status" class="status" aria-live="polite">${esc(ui.status)}</p>
            <p id="voice-note" class="fine">${esc(voice)}</p>
            ${note}
          </section>
          ${resultHtml(sentence)}
          ${audioHtml(sentence)}
          ${manualHtml(showManual)}
          ${pagerHtml(track, lesson, index)}
        </div>
        ${historyHtml(sentence.id)}
      </div>
    </main>`;
}

function pagerHtml(track, lesson, index) {
  const prev = neighborSentence(track, lesson.id, index, -1);
  const next = neighborSentence(track, lesson.id, index, 1);
  const prevHtml = prev
    ? `<a class="btn" href="${practiceHash(track.id, prev.lessonId, prev.index)}">이전 문장</a>`
    : `<span class="btn is-disabled" aria-disabled="true">이전 문장</span>`;
  const nextHtml = next
    ? `<a class="btn btn-primary" href="${practiceHash(track.id, next.lessonId, next.index)}">다음 문장</a>`
    : `<span class="btn is-disabled" aria-disabled="true">마지막 문장</span>`;
  return `<div class="pager">${prevHtml}${nextHtml}</div>`;
}

function voiceNote(lang) {
  const support = supportState();
  if (!support.synthesis) return "이 브라우저에서는 목소리 듣기를 지원하지 않습니다.";
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return "듣기는 이 기기에 설치된 목소리를 사용합니다.";
  const voice = pickVoice(voices, lang);
  if (!voice) {
    const name = lang.startsWith("ja") ? "일본어" : "영어";
    return `${name} 음성을 찾지 못했습니다. 기기 설정에서 ${name} 음성을 받으면 더 정확합니다. 지금은 브라우저 기본 음성으로 재생합니다.`;
  }
  return `음성: ${voice.name}`;
}

function paint() {
  const view = document.getElementById("view");
  if (!view) return;
  const model = screenModel();
  if (model.kind === "practice") rememberPosition(model.track, model.lesson, model.index);
  const titles = {
    home: "발음 연습",
    track: `${model.track?.title || ""} · 발음 연습`,
    practice: `${model.lesson?.title || ""} · 발음 연습`,
    missing: "발음 연습",
  };
  document.title = titles[model.kind] || "발음 연습";
  if (model.kind === "home") view.innerHTML = viewHome();
  else if (model.kind === "track") view.innerHTML = viewTrack(model.track);
  else if (model.kind === "practice") view.innerHTML = viewPractice(model);
  else view.innerHTML = viewMissing();
}

function stopSpeaking() {
  cancelSpeak = true;
  try { speakHandle?.cancel(); } catch { /* ignore */ }
  speakHandle = null;
  if (ui.phase === "speaking") ui.phase = "idle";
}

function stopTracks(stream) {
  try { stream?.getTracks().forEach((track) => track.stop()); } catch { /* ignore */ }
}

function abandonSession() {
  const box = session;
  session = null;
  if (!box) return;
  box.abandoned = true;
  clearTimeout(box.timer);
  try { box.handle?.abort(); } catch { /* ignore */ }
  try { box.recorder?.stop(); } catch { /* ignore */ }
  stopTracks(box.stream);
  if (ui.phase === "listening" || ui.phase === "recording") ui.phase = "idle";
}

async function takeClip(box) {
  if (!box?.recorder) return null;
  try { return await box.recorder.stop(); } catch { return null; }
}

function activeSentence() {
  const model = screenModel();
  return model.kind === "practice" ? model : null;
}

async function completeRecognition(box) {
  if (box.completed) return;
  box.completed = true;
  try { await box.micPromise; } catch { /* micError is stored */ }
  if (box.abandoned) return;
  clearTimeout(box.timer);
  if (session?.token === box.token) session = null;
  const clip = await takeClip(box);
  stopTracks(box.stream);
  if (box.abandoned) return;
  const model = activeSentence();
  ui.phase = "idle";
  if (!model || model.sentence.id !== box.sentenceId) {
    paint();
    return;
  }
  if (clip?.blob) saveClip(box.sentenceId, clip);
  if (box.finalText) {
    const evaluation = evaluateAttempt(model.sentence, box.finalText);
    progress = recordAttempt(progress, box.sentenceId, {
      at: new Date().toISOString(),
      score: evaluation.score,
      recognized: evaluation.recognized,
      source: "recognition",
    });
    persist();
    ui.result = { sentenceId: box.sentenceId, evaluation };
    ui.offerManual = false;
    ui.error = box.micError ? micErrorMessage(box.micError) : "";
    ui.status = "";
    announce(`${evaluation.score}점. ${evaluation.label}`);
  } else {
    ui.result = null;
    ui.offerManual = true;
    const message = (box.error && recognitionErrorMessage(box.error)) || "말을 알아듣지 못했습니다. 녹음으로 비교하거나 스스로 점수를 남겨 주세요.";
    ui.error = message;
    ui.status = box.micError ? micErrorMessage(box.micError) : "";
    announce(message);
  }
  paint();
}

function saveClip(sentenceId, info) {
  const previous = clips.get(sentenceId);
  if (previous?.url) URL.revokeObjectURL(previous.url);
  clips.set(sentenceId, {
    url: URL.createObjectURL(info.blob),
    blob: info.blob,
    mimeType: info.mimeType || info.blob.type,
  });
}

function onListen(model) {
  if (ui.phase === "speaking") {
    stopSpeaking();
    ui.status = "";
    paint();
    return;
  }
  if (ui.phase === "listening" || ui.phase === "recording") return;
  cancelSpeak = false;
  const voice = pickVoice(window.speechSynthesis?.getVoices?.() || [], model.track.lang);
  ui.phase = "speaking";
  ui.error = "";
  ui.status = "모델 음성을 재생합니다.";
  paint();
  const handle = speak({
    synth: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance,
    text: surfaceText(model.sentence),
    lang: model.track.lang,
    rate: progress.speed,
    voice,
    onend: () => {
      if (cancelSpeak) return;
      if (ui.phase === "speaking") {
        ui.phase = "idle";
        ui.status = "";
        paint();
      }
    },
    onerror: () => {
      if (cancelSpeak) return;
      ui.phase = "idle";
      ui.error = "목소리 재생에 실패했습니다.";
      ui.status = "";
      paint();
    },
  });
  if (!handle.ok) {
    ui.phase = "idle";
    ui.error = "이 브라우저에서는 목소리 듣기를 지원하지 않습니다.";
    ui.status = "";
    paint();
    return;
  }
  speakHandle = handle;
}

function onSpeak(model) {
  stopSpeaking();
  abandonSession();
  const Ctor = getRecognitionCtor(window);
  if (!Ctor || !supportState().secure) {
    ui.error = "이 브라우저에서는 말한 내용을 자동으로 받아 적지 못합니다.";
    ui.offerManual = true;
    paint();
    return;
  }
  const box = {
    token: {},
    sentenceId: model.sentence.id,
    finished: false,
    completed: false,
    abandoned: false,
    finalText: "",
    error: "",
    micError: null,
    stream: null,
    recorder: null,
  };
  const support = supportState();
  box.micPromise = support.recording
    ? openMic(navigator.mediaDevices).then((stream) => {
      if (box.abandoned) {
        stopTracks(stream);
        return null;
      }
      try {
        const mime = pickRecorderMime(typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported
          ? (type) => MediaRecorder.isTypeSupported(type)
          : null);
        box.stream = stream;
        box.recorder = startMediaRecorder(window.MediaRecorder, stream, mime);
        return box.recorder;
      } catch (error) {
        box.micError = error;
        stopTracks(stream);
        return null;
      }
    }).catch((error) => {
      box.micError = error;
      return null;
    })
    : Promise.resolve(null);
  ui.phase = "listening";
  ui.error = "";
  ui.status = "듣는 중… 말이 끝나면 중지를 누르거나 잠시 멈추세요.";
  ui.result = null;
  session = box;
  const handle = runRecognition({
    Recognition: Ctor,
    lang: model.track.lang,
    onPartial: (text) => {
      if (session?.token === box.token) setStatus(text);
    },
    onFinal: (text) => { box.finalText = text; },
    onError: (code) => { if (code && code !== "aborted") box.error = code; },
    onEnd: () => { completeRecognition(box); },
  });
  if (!handle.ok) {
    session = null;
    box.abandoned = true;
    ui.phase = "idle";
    ui.error = "음성 인식을 시작하지 못했습니다. 녹음과 스스로 평가를 이용해 주세요.";
    ui.offerManual = true;
    paint();
    return;
  }
  box.handle = handle;
  box.timer = setTimeout(() => {
    if (session?.token === box.token) box.handle?.stop();
  }, 20000);
  paint();
}

function onRecord(model) {
  stopSpeaking();
  abandonSession();
  const support = supportState();
  if (!support.recording || !support.secure) {
    ui.error = "이 브라우저에서는 녹음 파일을 만들 수 없습니다.";
    paint();
    return;
  }
  const box = {
    token: {},
    sentenceId: model.sentence.id,
    mode: "record",
    abandoned: false,
    stream: null,
    recorder: null,
    micPromise: openMic(navigator.mediaDevices),
  };
  ui.phase = "recording";
  ui.error = "";
  ui.status = "녹음 중… 끝나면 중지를 누르세요.";
  session = box;
  paint();
  box.micPromise.then((stream) => {
    if (box.abandoned || session?.token !== box.token) {
      stopTracks(stream);
      return;
    }
    const mime = pickRecorderMime(typeof MediaRecorder !== "undefined" ? (type) => MediaRecorder.isTypeSupported(type) : null);
    box.stream = stream;
    box.recorder = startMediaRecorder(window.MediaRecorder, stream, mime);
    box.timer = setTimeout(() => {
      if (session?.token === box.token) stopRecording(box);
    }, 20000);
  }).catch((error) => {
    if (box.abandoned) return;
    session = null;
    ui.phase = "idle";
    ui.error = micErrorMessage(error);
    ui.status = "";
    paint();
  });
}

async function stopRecording(box) {
  if (!box || box.abandoned) return;
  box.abandoned = true;
  if (session?.token === box.token) session = null;
  clearTimeout(box.timer);
  const clip = await takeClip(box);
  stopTracks(box.stream);
  if (clip?.blob) saveClip(box.sentenceId, clip);
  ui.phase = "idle";
  ui.offerManual = true;
  ui.status = clip?.blob
    ? "녹음이 끝났습니다. 모델과 비교하고 스스로 점수를 남겨 주세요."
    : "녹음을 마무리하지 못했습니다.";
  ui.error = "";
  announce(ui.status);
  paint();
}

function onRate(model, score) {
  const value = Number(score);
  if (![40, 75, 100].includes(value)) return;
  progress = recordAttempt(progress, model.sentence.id, {
    at: new Date().toISOString(),
    score: value,
    recognized: "",
    source: "manual",
  });
  persist();
  ui.result = {
    sentenceId: model.sentence.id,
    evaluation: {
      manual: true,
      score: value,
      label: scoreLabel(value),
      hints: ["스스로 남긴 점수입니다. 모델 음성과 내 녹음을 다시 들어 보세요."],
      recognized: "",
    },
  };
  ui.error = "";
  announce(`스스로 평가 ${value}점. ${scoreLabel(value)}`);
  paint();
}

function onDownload(model) {
  const clip = clips.get(model.sentence.id);
  if (!clip) return;
  const link = document.createElement("a");
  link.href = clip.url;
  link.download = `${model.sentence.id}.${fileExtension(clip.mimeType)}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const model = activeSentence();
  if (!model) return;
  const action = button.dataset.action;
  if (action === "listen" || action === "model") onListen(model);
  else if (action === "stop-speak") { stopSpeaking(); ui.status = ""; paint(); }
  else if (action === "speak") onSpeak(model);
  else if (action === "stop-listen") session?.handle?.stop();
  else if (action === "record") onRecord(model);
  else if (action === "stop-record") stopRecording(session);
  else if (action === "rate") onRate(model, button.dataset.score);
  else if (action === "download") onDownload(model);
}

function onInput(event) {
  if (event.target.id !== "speed") return;
  progress = { ...progress, speed: clampSpeed(event.target.value) };
  persist();
  const label = document.getElementById("speed-label");
  if (label) label.textContent = speedText(progress.speed);
}

function boot() {
  try { progress = loadProgress(localStorage); } catch { progress = emptyProgress(); }
  const app = document.getElementById("app");
  app.innerHTML = `<div id="live" class="sr" aria-live="polite"></div><div id="view"></div>`;
  app.addEventListener("click", onClick);
  app.addEventListener("input", onInput);
  window.addEventListener("hashchange", () => {
    stopSpeaking();
    abandonSession();
    ui.phase = "idle";
    ui.status = "";
    ui.error = "";
    ui.result = null;
    ui.offerManual = false;
    if (fixHash()) return;
    paint();
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });
  window.speechSynthesis?.addEventListener?.("voiceschanged", () => {
    const note = document.getElementById("voice-note");
    const model = activeSentence();
    if (note && model) note.textContent = voiceNote(model.track.lang);
  });
  if (fixHash()) return;
  paint();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();
