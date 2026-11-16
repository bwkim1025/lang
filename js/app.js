import { TRACKS, findSentence, getLesson, getTrack, listSentenceIds, neighborSentence, surfaceText } from "./data.js";
import { evaluateAttempt, manualLabel, scoreLabel } from "./diff.js";
import { splitEnglishDisplay } from "./diff.js";
import { lessonsHash, parseHash, practiceHash, statsHash, trackHash } from "./route.js";
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
import { buildStats, listAttempts, mistakeSounds, resumeIndex, reviewSentences } from "./stats.js";
import { loadProgress, recordAttempt, saveProgress, summarize } from "./storage.js";

const RATINGS = [
  { score: 100, label: "잘함", note: "다음 문장으로" },
  { score: 75, label: "보통", note: "나중에 복습" },
  { score: 40, label: "다시", note: "한 번 더" },
];

const I = {
  home: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  lessons: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/></svg>`,
  mic: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/></svg>`,
  chart: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/></svg>`,
  back: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`,
  next: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`,
  speaker: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5l4.5 4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6a9 9 0 0 1 0 12"/></svg>`,
  play: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>`,
  stop: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/></svg>`,
  check: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  flame: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.5 3 4.5 5 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .8-3.2 1.8-4.2.2 1.6 1 2.5 2.2 2.7C11 9 11 6 12 3z"/></svg>`,
  down: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/></svg>`,
  swap: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/></svg>`,
  phone: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>`,
  close: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  info: `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8h.01"/></svg>`,
};

const ui = {
  phase: "idle",
  status: "",
  error: "",
  result: null,
  offerManual: false,
  playMode: "model",
  startedAt: 0,
  altAfter: false,
};

let progress = null;
let session = null;
let speakHandle = null;
let cancelSpeak = false;
let ticker = 0;
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

function persist() {
  try { progress = saveProgress(localStorage, progress); } catch { /* 화면은 유지합니다. */ }
}

function supportState() {
  return {
    recognition: Boolean(getRecognitionCtor(window)),
    recording: typeof window.MediaRecorder === "function" && Boolean(navigator.mediaDevices?.getUserMedia),
    secure: window.isSecureContext !== false,
    synthesis: typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance === "function",
  };
}

function speedChoice(speed) {
  return Number(speed) >= 0.9 ? 1 : 0.7;
}

function speedName(speed) {
  return speedChoice(speed) >= 0.9 ? "보통" : "느리게";
}

function mark() {
  return `<img class="mark" alt="" src="./icons/icon.svg">`;
}

function ring(score) {
  const radius = 31;
  const circ = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(100, score)) / 100 * circ;
  return `<div class="ring" role="img" aria-label="점수 ${score}점"><svg viewBox="0 0 76 76"><circle cx="38" cy="38" r="31" fill="none" stroke="var(--sub)" stroke-width="8"/><circle cx="38" cy="38" r="31" fill="none" stroke="var(--c)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"/></svg><b>${score}</b></div>`;
}

function scoreClass(score) {
  if (score >= 80) return "score hi";
  if (score < 70) return "score low";
  return "score";
}

function relativeTime(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = Date.now() - then;
  if (delta < 60000) return "방금";
  if (delta < 3600000) return `${Math.floor(delta / 60000)}분 전`;
  if (delta < 86400000) return `${Math.floor(delta / 3600000)}시간 전`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const key = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  if (key(new Date(iso)) === key(yesterday)) return "어제";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(iso));
}

function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function currentPlace() {
  const current = progress.current;
  if (current) {
    const track = getTrack(current.trackId);
    const lesson = getLesson(track, current.lessonId);
    if (track && lesson) {
      const index = Math.min(Math.max(Number(current.index) || 0, 0), lesson.sentences.length - 1);
      return { track, lesson, index };
    }
  }
  const track = TRACKS[0];
  return { track, lesson: track.lessons[0], index: 0 };
}

function practiceHref() {
  const place = currentPlace();
  return practiceHash(place.track.id, place.lesson.id, place.index);
}

function screenModel() {
  const route = parseHash(location.hash);
  if (route.name === "stats") return { kind: "stats" };
  if (route.name === "lessons") {
    const track = getTrack(route.trackId) || getTrack(progress.lastTrack) || TRACKS[0];
    const lesson = getLesson(track, route.lessonId) || track.lessons.find((item) => item.id === progress.current?.lessonId && progress.current?.trackId === track.id) || track.lessons[0];
    return { kind: "lessons", track, lesson };
  }
  if (route.name === "practice") {
    const track = getTrack(route.trackId);
    const lesson = getLesson(track, route.lessonId);
    if (!track || !lesson) return { kind: "missing" };
    const index = Math.min(Math.max(route.index, 0), lesson.sentences.length - 1);
    return { kind: "practice", track, lesson, index, sentence: lesson.sentences[index] };
  }
  return { kind: "home" };
}

function nav(active) {
  const items = [
    ["home", "#/", "홈", I.home],
    ["lessons", trackHash(progress.lastTrack || "ja"), "레슨", I.lessons],
    ["practice", practiceHref(), "연습", I.mic],
    ["stats", statsHash(), "기록", I.chart],
  ];
  const sideTracks = TRACKS.map((track) => {
    const stats = summarize(listSentenceIds(track), progress);
    const width = stats.total ? Math.round((stats.practiced / stats.total) * 100) : 0;
    return `<a class="trk" href="${practiceHrefFor(track)}"><span class="tile sm ${track.id === "ja" ? "jp" : "en"}">${track.id === "ja" ? "あ" : "A"}</span>${esc(track.title)}<span class="bar"><i style="width:${width}%"></i></span><span class="p">${stats.practiced}/${stats.total}</span></a>`;
  }).join("");
  const links = items.map(([id, href, label, icon]) => `<a class="nav" href="${href}" ${id === active ? 'aria-current="page"' : ""}>${icon}${label}</a>`).join("");
  const tabs = items.map(([id, href, label, icon]) => `<a class="tab" href="${href}" ${id === active ? 'aria-current="page"' : ""}>${icon}${label}</a>`).join("");
  return {
    side: `<aside class="side"><a class="brand" href="#/">${mark()}땡이네 발음 연습</a>${links}<p class="grp">이어서</p>${sideTracks}<p class="foot">${I.phone}기록은 이 기기에 저장돼요</p></aside>`,
    tabs: `<nav class="tabbar" aria-label="메뉴">${tabs}</nav>`,
  };
}

function practiceHrefFor(track) {
  if (progress.current?.trackId === track.id) return practiceHref();
  const lesson = track.lessons[0];
  return practiceHash(track.id, lesson.id, resumeIndex(lesson, progress));
}

function shell(active, focus, body) {
  const menu = nav(active);
  return `<div class="app${focus ? " focus" : ""}" data-screen="${active}">${menu.side}<main class="main"><div class="wrap">${body}</div></main>${menu.tabs}</div>`;
}

function rubyHtml(sentence) {
  return sentence.tokens.map((token) => {
    if (token.r && token.t !== token.r) return `<ruby>${esc(token.t)}<rt>${esc(token.r)}</rt></ruby>`;
    return esc(token.t);
  }).join("");
}

function englishHtml(sentence) {
  const keys = new Set(Object.keys(sentence.hints || {}));
  return splitEnglishDisplay(sentence.text).map((part) => {
    if (part.type === "word" && keys.has(part.key)) return `<span class="st">${esc(part.raw)}</span>`;
    return esc(part.raw);
  }).join("");
}

function cmpHtml(pieces, markOk) {
  return (pieces || []).map((piece) => {
    if (piece.status === "neutral" || (piece.status === "ok" && !markOk)) return esc(piece.text);
    if (piece.status === "ok") return `<span class="ok">${esc(piece.text)}</span>`;
    const status = piece.status === "bad" || piece.status === "miss" ? piece.status : "bad";
    return `<span class="${status}">${esc(piece.text)}</span>`;
  }).join("");
}

function bars(count = 18) {
  return Array.from({ length: count }, (_, index) => {
    const height = 6 + ((index * 17) % 22);
    return `<i style="height:${height}px; animation-delay:${(index * 0.07).toFixed(2)}s"></i>`;
  }).join("");
}

function trackMark(track) {
  return track.id === "ja" ? "あ" : "A";
}

function lessonListCard(track) {
  const rows = track.lessons.map((lesson) => {
    const summary = summarize(lesson.sentences.map((sentence) => sentence.id), progress);
    const resume = resumeIndex(lesson, progress);
    const width = summary.total ? Math.round((summary.practiced / summary.total) * 100) : 0;
    const average = summary.average == null ? "기록 없음" : `평균 ${summary.average}`;
    return `<a class="row" href="${practiceHash(track.id, lesson.id, resume)}"><span class="tile sm ${track.id === "ja" ? "jp" : "en"}">${trackMark(track)}</span><span class="tx"><span class="t1">${esc(lesson.title)}</span><span class="t2">${summary.practiced}/8 · ${esc(average)}</span></span><span class="bar" style="width:72px;height:6px;flex-shrink:0"><i style="width:${width}%"></i></span>${I.next}</a>`;
  }).join("");
  return `<section class="card"><div class="card-h"><h2>${esc(track.title)} 레슨</h2><a class="more" href="${lessonsHash(track.id)}">모두${I.next}</a></div><div>${rows}</div></section>`;
}

function sentenceListCard(track, lesson, index) {
  const rows = lesson.sentences.map((sentence, itemIndex) => {
    const record = progress.sentences?.[sentence.id];
    const score = typeof record?.bestScore === "number"
      ? `<span class="${scoreClass(record.bestScore)}">${record.bestScore}</span>`
      : `<span class="tag plain">아직</span>`;
    const current = itemIndex === index ? ` aria-current="true"` : "";
    return `<a class="row"${current} href="${practiceHash(track.id, lesson.id, itemIndex)}"><span class="score" style="background:transparent; color:var(--mute); min-width:26px">${itemIndex + 1}</span><span class="tx"><span class="t1 ${track.id === "ja" ? "jp" : "en"}">${esc(surfaceText(sentence))}</span><span class="t2">${esc(sentence.meaning)}</span></span>${score}</a>`;
  }).join("");
  return `<section class="card"><div class="card-h"><h2>${esc(lesson.title)}</h2></div><div class="sentlist">${rows}</div></section>`;
}

function nextCards() {
  const rows = TRACKS.map((track) => {
    const place = progress.current?.trackId === track.id
      ? currentPlace()
      : { lesson: track.lessons[0], index: resumeIndex(track.lessons[0], progress) };
    const sentence = place.lesson.sentences[place.index];
    return `<a class="row" href="${practiceHash(track.id, place.lesson.id, place.index)}"><span class="tile sm ${track.id === "ja" ? "jp" : "en"}">${trackMark(track)}</span><span class="tx"><span class="t1 ${track.id === "ja" ? "jp" : "en"}">${esc(surfaceText(sentence))}</span><span class="t2">${esc(track.title)} · ${esc(place.lesson.title)} · ${place.index + 1}/8</span></span>${I.next}</a>`;
  }).join("");
  return `<section class="card"><div class="card-h"><h2>다음 문장</h2></div><div>${rows}</div></section>`;
}

function recentRecordsCard(limit = 6) {
  const rows = listAttempts(progress).slice(-limit).reverse().map((attempt) => {
    const found = findSentence(attempt.sentenceId);
    if (!found) return "";
    const badge = attempt.source === "manual"
      ? `<span class="rate ${attempt.score >= 90 ? "good" : attempt.score < 60 ? "again" : ""}">${esc(manualLabel(attempt.score))}</span>`
      : `<span class="${scoreClass(attempt.score)}">${attempt.score}</span>`;
    return `<a class="row" href="${practiceHash(found.track.id, found.lesson.id, found.index)}"><span class="tile sm ${found.track.id === "ja" ? "jp" : "en"}">${trackMark(found.track)}</span><span class="tx"><span class="t1 ${found.track.id === "ja" ? "jp" : "en"}">${esc(surfaceText(found.sentence))}</span><span class="t2">${esc(relativeTime(attempt.at))} · ${esc(found.lesson.title)}</span></span>${badge}</a>`;
  }).join("");
  const body = rows || `<p class="empty">아직 기록이 없어요. 말하기를 하면 최근 연습이 여기에 모여요.</p>`;
  return `<section class="card"><div class="card-h"><h2>최근 기록</h2><a class="more" href="${statsHash()}">기록${I.next}</a></div><div>${body}</div></section>`;
}

function viewHome() {
  const stats = buildStats(progress);
  const maxWeek = Math.max(1, ...stats.week.map((day) => day.count));
  const week = stats.week.map((day) => `<span><i class="${day.count ? "on" : ""} ${day.today ? "today" : ""}">${day.count ? I.check : ""}</i>${esc(day.label)}</span>`).join("");
  const tracks = TRACKS.map((track) => {
    const summary = summarize(listSentenceIds(track), progress);
    const width = summary.total ? Math.round((summary.practiced / summary.total) * 100) : 0;
    const place = progress.current?.trackId === track.id ? currentPlace() : { lesson: track.lessons[0], index: resumeIndex(track.lessons[0], progress) };
    const average = summary.average == null ? "평균 —" : `평균 ${summary.average}`;
    return `<section class="card track"><div class="hd"><span class="tile ${track.id === "ja" ? "jp" : "en"}">${track.id === "ja" ? "あ" : "A"}</span><div class="tx"><h3>${esc(track.title)}</h3><p class="cur">${esc(place.lesson.title)} · ${place.index + 1}/8</p></div><span class="tag plain">${esc(average)}</span></div><div class="bar" role="progressbar" aria-valuenow="${width}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(track.title)} 진행률"><i style="width:${width}%"></i></div><div class="meta num"><span>${summary.practiced}/${summary.total} 문장</span><span>${width}%</span></div><a class="btn primary" href="${practiceHrefFor(track)}">${I.play}이어서 하기</a></section>`;
  }).join("");
  const reviews = reviewSentences(progress);
  const reviewHtml = reviews.length
    ? reviews.map((row) => `<a class="row" href="${practiceHash(row.track.id, row.lesson.id, row.index)}"><span class="tile sm ${row.track.id === "ja" ? "jp" : "en"}">${row.track.id === "ja" ? "あ" : "A"}</span><span class="tx"><span class="t1 ${row.track.id === "ja" ? "jp" : "en"}">${esc(surfaceText(row.sentence))}</span><span class="t2">${esc(row.sentence.meaning)}</span></span><span class="${scoreClass(row.bestScore)}">${row.bestScore}</span>${I.next}</a>`).join("")
    : `<p class="empty">아직 복습할 문장이 없어요. 말하기를 하면 점수가 낮은 문장이 여기 모여요.</p>`;
  const chart = stats.week.map((day) => `<div class="col${day.today ? " today" : ""}"><i style="height:${Math.max(3, Math.round((day.count / maxWeek) * 100))}%"></i><span>${day.day}</span></div>`).join("");
  const rail = `<aside class="rail home-rail">${TRACKS.map((track) => lessonListCard(track)).join("")}</aside>`;
  const body = `<header class="top">${mark()}<h1>땡이네 발음 연습</h1></header><div class="home">${rail}<div class="colA"><section class="hero" aria-label="오늘 연습"><div class="l"><span class="lab">오늘 연습 · ${esc(stats.todayLabel)}</span><div class="big"><b>${stats.todayCount}</b><span>문장</span></div><div class="kpis"><span class="stat">${I.flame}연속 ${stats.streak}일</span><span class="stat">${I.chart}최근 7일 ${stats.weekTotal}문장</span></div></div><div class="week">${week}</div></section><div class="tracks">${tracks}</div></div><div class="colB"><section class="card"><div class="card-h"><h2>복습 · 최근 많이 틀린 문장</h2></div><div>${reviewHtml}</div></section><section class="card"><div class="card-h"><h2>최근 7일</h2><a class="more" href="${statsHash()}">기록 보기${I.next}</a></div><div class="chart" style="height:96px; grid-template-columns: repeat(7, 1fr)" role="img" aria-label="최근 7일 연습 문장 수">${chart}</div></section></div></div>`;
  return shell("home", false, body);
}

function viewLessons(model) {
  const { track, lesson } = model;
  const cards = track.lessons.map((item) => {
    const summary = summarize(item.sentences.map((sentence) => sentence.id), progress);
    const done = summary.total > 0 && summary.mastered === summary.total;
    const started = summary.practiced > 0;
    const state = done ? "완료" : started ? "진행 중" : "시작 전";
    const noClass = done ? "done" : item.id === lesson.id ? "now" : "";
    const selected = item.id === lesson.id ? " on" : "";
    return `<button class="lesson${selected}" type="button" data-action="open-lesson" data-track="${esc(track.id)}" data-lesson="${esc(item.id)}"><span class="no ${noClass}">${done ? I.check : item.level}</span><span class="tx"><h3>${esc(item.title)}</h3><span class="meta"><span class="bar"><i style="width:${summary.total ? Math.round((summary.practiced / summary.total) * 100) : 0}%"></i></span><span>${summary.practiced}/8</span><span>${summary.average == null ? "—" : `최고 ${summary.average}`}</span><span>${state}</span></span></span></button>`;
  }).join("");
  const rows = lesson.sentences.map((sentence, index) => {
    const record = progress.sentences?.[sentence.id];
    const score = typeof record?.bestScore === "number"
      ? `<span class="${scoreClass(record.bestScore)}">${record.bestScore}</span>`
      : `<span class="tag plain">아직</span>`;
    return `<a class="row" href="${practiceHash(track.id, lesson.id, index)}"><span class="score" style="background:transparent; color:var(--mute); min-width:26px">${index + 1}</span><span class="tx"><span class="t1 ${track.id === "ja" ? "jp" : "en"}">${esc(surfaceText(sentence))}</span><span class="t2">${esc(sentence.meaning)}</span></span>${score}</a>`;
  }).join("");
  const resume = resumeIndex(lesson, progress);
  const other = TRACKS.find((item) => item.id !== track.id);
  const rail = `<aside class="rail lesson-rail">${lessonListCard(other)}${recentRecordsCard(5)}</aside>`;
  const body = `<header class="top"><h1>레슨</h1></header><div class="seg" role="group" aria-label="언어">${TRACKS.map((item) => `<a href="${lessonsHash(item.id)}" aria-pressed="${item.id === track.id}">${item.id === "ja" ? "あ 일본어" : "A 영어"}</a>`).join("")}</div><div class="lesson-wrap"><div class="lessons">${cards}</div><section class="card lesson-panel"><div class="card-h"><h2>${esc(lesson.title)}</h2></div><p class="mean">${esc(lesson.summary)}</p><div class="sentlist">${rows}</div><a class="btn primary" href="${practiceHash(track.id, lesson.id, resume)}">${I.play}${resume + 1}번째 문장부터 이어서</a></section>${rail}</div>`;
  return shell("lessons", false, body);
}

function viewStats() {
  const stats = buildStats(progress);
  const maxBar = Math.max(1, ...stats.fortnight.map((day) => day.count));
  const chart = stats.fortnight.map((day) => `<div class="col${day.today ? " today" : ""}"><i style="height:${Math.max(3, Math.round((day.count / maxBar) * 100))}%"></i><span>${esc(day.label)}</span></div>`).join("");
  const tracks = TRACKS.map((track) => {
    const summary = summarize(listSentenceIds(track), progress);
    const width = summary.average == null ? 0 : summary.average;
    return `<div class="hbar"><span class="nm"><span class="tile sm ${track.id === "ja" ? "jp" : "en"}">${track.id === "ja" ? "あ" : "A"}</span>${esc(track.title)}</span><span class="bar"><i style="width:${width}%"></i></span><span class="v">${summary.average == null ? "—" : summary.average}</span></div>`;
  }).join("");
  const sounds = mistakeSounds(progress);
  const soundRows = sounds.length
    ? sounds.map((sound, index) => `<div class="row"><span class="rk">${index + 1}</span><span class="tx"><span class="t1">${esc(sound.label)}</span><span class="t2">${esc(sound.examples.join(", "))}</span></span><span class="bar"><i style="width:${Math.round((sound.count / sounds[0].count) * 100)}%"></i></span><span class="cnt">${sound.count}</span></div>`).join("")
    : `<p class="empty">아직 모을 발음이 없어요. 말하기를 하면 자주 틀린 소리가 여기 모여요.</p>`;
  const rail = `<aside class="rail stats-rail">${nextCards()}${recentRecordsCard(8)}</aside>`;
  const body = `<header class="top"><h1>기록</h1></header><div class="stats"><div class="colA"><div class="sum"><div class="card"><span class="k">최근 7일</span><span class="v">${stats.weekTotal}<small>문장</small></span></div><div class="card"><span class="k">연속</span><span class="v">${stats.streak}<small>일</small></span></div><div class="card"><span class="k">평균 점수</span><span class="v">${stats.average == null ? "—" : stats.average}<small>점</small></span></div></div><section class="card"><div class="card-h"><h2>날짜별 연습량</h2><span class="tag plain" style="margin-left:auto">최근 14일</span></div><div class="chart" role="img" aria-label="최근 14일 연습 문장 수">${chart}</div></section></div><div class="colB"><section class="card"><div class="card-h"><h2>트랙별 평균</h2></div>${tracks}</section><section class="card top5"><div class="card-h"><h2>자주 틀리는 소리</h2></div><div>${soundRows}</div></section></div>${rail}</div>`;
  return shell("stats", false, body);
}

function viewMissing() {
  return shell("home", false, `<header class="top"><h1>없는 화면입니다</h1></header><p class="empty">주소가 바뀌었거나 레슨이 없습니다.</p><a class="btn primary" href="#/">홈으로</a>`);
}

function viewPractice(model) {
  const { track, lesson, index, sentence } = model;
  const support = supportState();
  const unsupported = !support.recognition || !support.secure;
  const showBanner = unsupported && !progress.hideUnsupported;
  const listening = ui.phase === "listening" || ui.phase === "recording";
  const clip = clips.get(sentence.id);
  const slow = speedChoice(progress.speed) < 0.9;
  const record = progress.sentences?.[sentence.id];
  const attempts = Array.isArray(record?.attempts) ? record.attempts : [];
  const best = typeof record?.bestScore === "number" ? record.bestScore : null;
  const evaluation = ui.result?.sentenceId === sentence.id ? ui.result.evaluation : null;
  const manual = Boolean(evaluation?.manual);
  const prev = neighborSentence(track, lesson.id, index, -1);
  const next = neighborSentence(track, lesson.id, index, 1);
  const steps = lesson.sentences.map((item, itemIndex) => {
    const done = typeof progress.sentences?.[item.id]?.bestScore === "number";
    const cls = itemIndex === index ? "now" : done ? "done" : "";
    return `<i class="${cls}"></i>`;
  }).join("");
  const target = sentence.tokens
    ? `<p class="target jp" lang="ja">${rubyHtml(sentence)}</p>`
    : `<p class="target en" lang="en">${englishHtml(sentence)}</p>`;
  const tip = sentence.tip ? `<div class="tips"><span class="tip">${esc(sentence.tip)}</span></div>` : "";
  const limit = lesson.note ? `<p class="mean">${esc(lesson.note)}</p>` : "";
  const banner = showBanner ? `<div class="banner"><span class="ic">${I.info}</span><span class="tx"><b>이 브라우저에서는 음성 인식이 안 돼요</b><span>녹음해서 모델과 비교하고 스스로 평가해 주세요.</span></span><button class="icon-btn" type="button" data-action="dismiss" aria-label="안내 닫기">${I.close}</button></div>` : "";
  const error = ui.error ? `<p class="live" role="alert">${esc(ui.error)}</p>` : "";
  const live = listening ? `<div class="live"><div class="wave" aria-hidden="true">${bars(16)}</div><span class="time" id="live-time">듣고 있어요 ${clock(Date.now() - ui.startedAt)}</span></div>` : "";
  const speakLabel = listening ? "멈추기" : unsupported ? "녹음하기" : "말하기";
  const speakAction = listening ? (ui.phase === "recording" ? "stop-record" : "stop-listen") : unsupported ? "record" : "speak";
  const mineLabel = clip ? clock((clip.seconds || 0) * 1000) : "아직 없음";
  const result = evaluation && !manual ? resultCard(evaluation, best) : "";
  const self = unsupported || ui.offerManual || manual ? selfCard(manual ? evaluation.score : null) : "";
  const mine = mineCard(sentence, clip);
  const recent = recentCard(attempts, best);
  const head = `<div class="prac-head"><div class="top"><a class="icon-btn" href="${trackHash(track.id)}" aria-label="레슨 목록">${I.back}</a><h1>${esc(lesson.title)}</h1><span class="sp pos">${index + 1}/8</span>${prev ? `<a class="icon-btn" href="${practiceHash(track.id, prev.lessonId, prev.index)}" aria-label="이전 문장">${I.back}</a>` : `<button class="icon-btn" type="button" disabled aria-label="이전 문장">${I.back}</button>`}${next ? `<a class="icon-btn" href="${practiceHash(track.id, next.lessonId, next.index)}" aria-label="다음 문장">${I.next}</a>` : `<button class="icon-btn" type="button" disabled aria-label="다음 문장">${I.next}</button>`}</div><div class="steps" aria-hidden="true">${steps}</div></div>`;
  const sent = `<section class="card sent" aria-label="연습 문장"><div class="who"><span class="tile sm ${track.id === "ja" ? "jp" : "en"}">${track.id === "ja" ? "あ" : "A"}</span>${esc(track.title)} · 문장 ${index + 1}</div>${target}<p class="mean">${esc(sentence.meaning)}</p>${tip}${limit}<div class="ft">듣기 속도<div class="seg" role="group" aria-label="듣기 속도"><button type="button" data-action="speed" data-speed="0.7" aria-pressed="${slow}">느리게</button><button type="button" data-action="speed" data-speed="1" aria-pressed="${!slow}">보통</button></div></div></section>`;
  const actions = `<div class="actions">${live}${error}<div class="act-row"><button class="act" type="button" data-action="${ui.phase === "speaking" ? "stop-speak" : "listen"}" aria-pressed="${ui.phase === "speaking"}"><span class="ic">${I.speaker}</span>듣기<span class="speed">${esc(speedName(progress.speed))}</span></button><button class="act speak${listening ? " rec" : ""}" type="button" data-action="${speakAction}" aria-pressed="${listening}"><span class="ic">${listening ? I.stop : I.mic}</span>${speakLabel}</button><button class="act" type="button" data-action="play-mine" ${clip ? "" : "disabled"}><span class="ic">${I.play}</span>내 녹음<span class="speed">${esc(mineLabel)}</span></button></div></div>`;
  const audio = clip ? `<audio id="clip" class="clip" src="${esc(clip.url)}"></audio>` : "";
  const rail = `<aside class="rail prac-rail">${sentenceListCard(track, lesson, index)}</aside>`;
  const body = `<div class="prac${unsupported ? " self" : ""}">${rail}${head}${banner}${sent}${actions}<div class="side-stack">${result}${self}${mine}${recent}</div></div>${audio}`;
  return shell("practice", true, body);
}

function resultCard(evaluation, best) {
  const when = "방금";
  const bestText = best == null ? "" : ` · 최고 ${best}점`;
  const hints = (evaluation.hints || []).map((hint, index) => `<li class="hint"><span class="n">${index + 1}</span><span>${esc(hint)}</span></li>`).join("");
  const lang = evaluation.unitName === "글자" ? "jp" : "en";
  return `<section class="card result" aria-label="결과"><div class="res-top">${ring(evaluation.score)}<div class="tx"><b>${esc(evaluation.label || scoreLabel(evaluation.score))}</b><span>${when} · ${evaluation.score}점${esc(bestText)}</span></div></div><div class="cmp"><div class="cmp-row"><span class="cmp-lab">목표 문장</span><p class="cmp-txt ${lang}">${cmpHtml(evaluation.compareTarget, true)}</p></div><div class="cmp-row"><span class="cmp-lab">알아들은 말</span><p class="cmp-txt heard ${lang}">${evaluation.compareHeard?.length ? cmpHtml(evaluation.compareHeard, false) : esc(evaluation.recognized || "들은 말이 없습니다.")}</p></div></div><div class="legend"><span><i class="sw ok"></i>맞음</span><span><i class="sw bad"></i>다름 (굵게·물결 밑줄)</span><span><i class="sw miss"></i>빠짐 (점선 밑줄)</span></div>${hints ? `<ol class="hints">${hints}</ol>` : `<p class="empty">어긋난 부분이 없습니다.</p>`}</section>`;
}

function selfCard(selected) {
  const buttons = RATINGS.map((rating) => `<button type="button" data-action="rate" data-score="${rating.score}" aria-pressed="${selected === rating.score}">${esc(rating.label)}<span>${esc(rating.note)}</span></button>`).join("");
  return `<section class="card selfcheck" aria-label="스스로 평가"><div class="card-h"><h2>모델과 비교해 보세요</h2></div><p class="mean">모델 음성과 내 녹음을 번갈아 듣고, 오늘 이 문장이 어땠는지 골라 주세요.</p><div class="selfrate" role="group" aria-label="스스로 평가">${buttons}</div></section>`;
}

function mineCard(sentence, clip) {
  const mode = ui.playMode;
  return `<section class="card mine" aria-label="내 녹음"><div class="card-h"><h2>내 녹음</h2>${clip ? `<span class="tag plain" style="margin-left:auto">${esc(clock((clip.seconds || 0) * 1000))}</span>` : ""}</div><div class="wavebox"><button class="icon-btn" type="button" data-action="play-selected" aria-label="내 녹음 재생" ${clip || mode === "model" ? "" : "disabled"} style="background:var(--c-s); color:var(--c-t); border-radius:50%">${I.play}</button><div class="mini" aria-hidden="true">${bars(28)}</div></div><div class="btns"><div class="seg" role="group" aria-label="들을 소리"><button type="button" data-action="mode" data-mode="model" aria-pressed="${mode === "model"}">모델</button><button type="button" data-action="mode" data-mode="mine" aria-pressed="${mode === "mine"}" ${clip ? "" : "disabled"}>내 목소리</button><button type="button" data-action="mode" data-mode="alt" aria-pressed="${mode === "alt"}" ${clip ? "" : "disabled"}>${I.swap}번갈아</button></div><button class="btn line" type="button" data-action="download" ${clip ? "" : "disabled"}>${I.down}녹음 저장</button></div><p class="empty">받은 파일은 튜터에게 보낼 수 있어요. 새로고침하면 이 녹음은 사라집니다.</p></section>`;
}

function recentCard(attempts, best) {
  const latest = [...attempts].reverse().slice(0, 3);
  const rows = latest.length
    ? latest.map((attempt) => {
      const badge = attempt.source === "manual"
        ? `<span class="rate ${attempt.score >= 90 ? "good" : attempt.score < 60 ? "again" : ""}">${esc(manualLabel(attempt.score))}</span>`
        : `<span class="${scoreClass(attempt.score)}">${attempt.score}</span>`;
      const top = best != null && attempt.score === best ? `<span class="tag">최고</span>` : "";
      return `<div class="row" style="min-height:46px">${badge}<span class="tx"><span class="t1" style="font-weight:500">${esc(relativeTime(attempt.at))}</span></span>${top}</div>`;
    }).join("")
    : `<p class="empty">아직 이 문장의 기록이 없습니다.</p>`;
  return `<section class="card recent" aria-label="최근 시도"><div class="card-h"><h2>최근 시도</h2></div><div>${rows}</div></section>`;
}

function paint() {
  const root = document.getElementById("app");
  if (!root) return;
  const model = screenModel();
  if (model.kind === "practice") {
    const current = { trackId: model.track.id, lessonId: model.lesson.id, index: model.index };
    const prev = progress.current;
    if (!prev || prev.trackId !== current.trackId || prev.lessonId !== current.lessonId || prev.index !== current.index || progress.lastTrack !== model.track.id) {
      progress = { ...progress, current, lastTrack: model.track.id };
      persist();
    }
  }
  const titles = { home: "땡이네 발음 연습", lessons: "레슨 · 땡이네 발음 연습", practice: "연습 · 땡이네 발음 연습", stats: "기록 · 땡이네 발음 연습", missing: "땡이네 발음 연습" };
  document.title = titles[model.kind] || "땡이네 발음 연습";
  if (model.kind === "home") root.innerHTML = viewHome();
  else if (model.kind === "lessons") root.innerHTML = viewLessons(model);
  else if (model.kind === "stats") root.innerHTML = viewStats();
  else if (model.kind === "practice") root.innerHTML = viewPractice(model);
  else root.innerHTML = viewMissing();
  ensureTicker();
}

function ensureTicker() {
  window.clearInterval(ticker);
  if (ui.phase !== "listening" && ui.phase !== "recording") return;
  ticker = window.setInterval(() => {
    const node = document.getElementById("live-time");
    if (node) node.textContent = `듣고 있어요 ${clock(Date.now() - ui.startedAt)}`;
  }, 250);
}

function activeSentence() {
  const model = screenModel();
  return model.kind === "practice" ? model : null;
}

function stopSpeaking() {
  cancelSpeak = true;
  ui.altAfter = false;
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
  window.clearTimeout(box.timer);
  try { box.handle?.abort(); } catch { /* ignore */ }
  try { box.recorder?.stop(); } catch { /* ignore */ }
  stopTracks(box.stream);
  if (ui.phase === "listening" || ui.phase === "recording") ui.phase = "idle";
}

async function takeClip(box) {
  if (!box?.recorder) return null;
  try { return await box.recorder.stop(); } catch { return null; }
}

function saveClip(sentenceId, info, seconds) {
  const previous = clips.get(sentenceId);
  if (previous?.url) URL.revokeObjectURL(previous.url);
  clips.set(sentenceId, {
    url: URL.createObjectURL(info.blob),
    blob: info.blob,
    mimeType: info.mimeType || info.blob.type,
    seconds: seconds || 0,
  });
}

function onListen(model, mode = "model") {
  if (ui.phase === "speaking") {
    stopSpeaking();
    ui.status = "";
    paint();
    return;
  }
  if (ui.phase === "listening" || ui.phase === "recording") return;
  if (mode === "mine") {
    document.getElementById("clip")?.play?.();
    return;
  }
  cancelSpeak = false;
  ui.altAfter = mode === "alt";
  const voice = pickVoice(window.speechSynthesis?.getVoices?.() || [], model.track.lang);
  ui.phase = "speaking";
  ui.error = "";
  paint();
  const handle = speak({
    synth: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance,
    text: surfaceText(model.sentence),
    lang: model.track.lang,
    rate: speedChoice(progress.speed) >= 0.9 ? 1 : 0.7,
    voice,
    onend: () => {
      if (cancelSpeak) return;
      const audio = ui.altAfter ? document.getElementById("clip") : null;
      ui.altAfter = false;
      ui.phase = "idle";
      paint();
      audio?.play?.();
    },
    onerror: () => {
      if (cancelSpeak) return;
      ui.phase = "idle";
      ui.altAfter = false;
      ui.error = "목소리 재생에 실패했습니다.";
      paint();
    },
  });
  if (!handle.ok) {
    ui.phase = "idle";
    ui.error = "이 브라우저에서는 목소리 듣기를 지원하지 않습니다.";
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
    ui.error = "이 브라우저에서는 음성 인식이 안 돼요. 녹음해서 비교해 주세요.";
    ui.offerManual = true;
    paint();
    return;
  }
  const box = tokenBox(model.sentence.id);
  box.micPromise = openMicPromise(box);
  ui.phase = "listening";
  ui.startedAt = Date.now();
  ui.error = "";
  ui.result = null;
  session = box;
  const handle = runRecognition({
    Recognition: Ctor,
    lang: model.track.lang,
    onPartial: (text) => { if (session?.token === box.token) setLive(text); },
    onFinal: (text) => { box.finalText = text; },
    onError: (code) => { if (code && code !== "aborted") box.error = code; },
    onEnd: () => { completeRecognition(box, model); },
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
  box.timer = window.setTimeout(() => { if (session?.token === box.token) box.handle?.stop(); }, 20000);
  paint();
}

function tokenBox(sentenceId) {
  return {
    token: {},
    sentenceId,
    completed: false,
    abandoned: false,
    finalText: "",
    error: "",
    micError: null,
    stream: null,
    recorder: null,
    micPromise: Promise.resolve(null),
  };
}

function openMicPromise(box) {
  if (!supportState().recording) return Promise.resolve(null);
  return openMic(navigator.mediaDevices).then((stream) => {
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
  });
}

function setLive(text) {
  const node = document.getElementById("live-time");
  if (node) node.textContent = text;
}

async function completeRecognition(box, model) {
  if (box.completed) return;
  box.completed = true;
  try { await box.micPromise; } catch { /* stored */ }
  if (box.abandoned) return;
  window.clearTimeout(box.timer);
  if (session?.token === box.token) session = null;
  const seconds = ui.startedAt ? (Date.now() - ui.startedAt) / 1000 : 0;
  const clip = await takeClip(box);
  stopTracks(box.stream);
  if (box.abandoned) return;
  ui.phase = "idle";
  if (clip?.blob) saveClip(box.sentenceId, clip, seconds);
  const current = activeSentence();
  if (!current || current.sentence.id !== box.sentenceId) {
    paint();
    return;
  }
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
  } else {
    ui.result = null;
    ui.offerManual = true;
    ui.error = (box.error && recognitionErrorMessage(box.error)) || "말을 알아듣지 못했습니다. 녹음으로 비교하거나 스스로 점수를 남겨 주세요.";
  }
  paint();
}

function onRecord(model) {
  stopSpeaking();
  abandonSession();
  if (!supportState().recording || !supportState().secure) {
    ui.error = "이 브라우저에서는 녹음 파일을 만들 수 없습니다.";
    paint();
    return;
  }
  const box = tokenBox(model.sentence.id);
  box.mode = "record";
  ui.phase = "recording";
  ui.startedAt = Date.now();
  ui.error = "";
  session = box;
  paint();
  box.micPromise = openMic(navigator.mediaDevices);
  box.micPromise.then((stream) => {
    if (box.abandoned || session?.token !== box.token) {
      stopTracks(stream);
      return;
    }
    const mime = pickRecorderMime(typeof MediaRecorder !== "undefined" ? (type) => MediaRecorder.isTypeSupported(type) : null);
    box.stream = stream;
    box.recorder = startMediaRecorder(window.MediaRecorder, stream, mime);
    box.timer = window.setTimeout(() => { if (session?.token === box.token) stopRecording(box); }, 20000);
  }).catch((error) => {
    if (box.abandoned) return;
    session = null;
    ui.phase = "idle";
    ui.error = micErrorMessage(error);
    paint();
  });
}

async function stopRecording(box) {
  if (!box || box.abandoned) return;
  box.abandoned = true;
  if (session?.token === box.token) session = null;
  window.clearTimeout(box.timer);
  const seconds = ui.startedAt ? (Date.now() - ui.startedAt) / 1000 : 0;
  const clip = await takeClip(box);
  stopTracks(box.stream);
  if (clip?.blob) saveClip(box.sentenceId, clip, seconds);
  ui.phase = "idle";
  ui.offerManual = true;
  ui.error = clip?.blob ? "" : "녹음을 마무리하지 못했습니다.";
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
    evaluation: { manual: true, score: value, label: manualLabel(value), hints: [], recognized: "" },
  };
  ui.error = "";
  paint();
  if (value === 100) {
    const next = neighborSentence(model.track, model.lesson.id, model.index, 1);
    if (next) location.hash = practiceHash(model.track.id, next.lessonId, next.index);
  }
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
  const action = button.dataset.action;
  if (action === "open-lesson") {
    const track = getTrack(button.dataset.track);
    const lesson = getLesson(track, button.dataset.lesson);
    if (!track || !lesson) return;
    const wide = document.getElementById("app").clientWidth >= 900;
    location.hash = wide
      ? lessonsHash(track.id, lesson.id)
      : practiceHash(track.id, lesson.id, resumeIndex(lesson, progress));
    return;
  }
  if (action === "dismiss") {
    progress = { ...progress, hideUnsupported: true };
    persist();
    paint();
    return;
  }
  if (action === "speed") {
    progress = { ...progress, speed: Number(button.dataset.speed) };
    persist();
    paint();
    return;
  }
  if (action === "mode") {
    ui.playMode = button.dataset.mode || "model";
    paint();
    return;
  }
  const model = activeSentence();
  if (!model) return;
  if (action === "listen") onListen(model, "model");
  else if (action === "stop-speak") { stopSpeaking(); paint(); }
  else if (action === "speak") onSpeak(model);
  else if (action === "stop-listen") session?.handle?.stop();
  else if (action === "record") onRecord(model);
  else if (action === "stop-record") stopRecording(session);
  else if (action === "rate") onRate(model, button.dataset.score);
  else if (action === "download") onDownload(model);
  else if (action === "play-mine") onListen(model, "mine");
  else if (action === "play-selected") onListen(model, ui.playMode);
}

function boot() {
  try { progress = loadProgress(localStorage); } catch { progress = loadProgress({ getItem: () => null, setItem() {} }); }
  const root = document.getElementById("app");
  root.classList.add("sy");
  root.addEventListener("click", onClick);
  window.addEventListener("hashchange", () => {
    stopSpeaking();
    abandonSession();
    ui.phase = "idle";
    ui.error = "";
    ui.result = null;
    ui.offerManual = false;
    paint();
    document.querySelector(".main")?.focus?.({ preventScroll: true });
    document.querySelector(".main")?.scrollTo?.(0, 0);
  });
  window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});
  paint();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

boot();
