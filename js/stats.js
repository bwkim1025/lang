import { findSentence } from "./data.js";
import { evaluateAttempt } from "./diff.js";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function listAttempts(progress) {
  const rows = [];
  const sentences = progress?.sentences || {};
  for (const [sentenceId, record] of Object.entries(sentences)) {
    if (!record || !Array.isArray(record.attempts)) continue;
    for (const attempt of record.attempts) {
      if (!attempt || typeof attempt.score !== "number") continue;
      rows.push({ ...attempt, sentenceId });
    }
  }
  rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return rows;
}

function daysBack(now, count) {
  const start = startOfDay(now);
  const days = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(start);
    date.setDate(start.getDate() - index);
    days.push(date);
  }
  return days;
}

export function activityByDay(attempts, now = new Date()) {
  const counts = new Map();
  const seen = new Map();
  for (const attempt of attempts) {
    const key = dayKey(attempt.at);
    if (!key) continue;
    const bucket = seen.get(key) || new Set();
    if (!bucket.has(attempt.sentenceId)) {
      bucket.add(attempt.sentenceId);
      seen.set(key, bucket);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

export function streakEnding(counts, now = new Date()) {
  let cursor = startOfDay(now);
  if (!counts.get(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (counts.get(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function buildStats(progress, now = new Date()) {
  const attempts = listAttempts(progress);
  const counts = activityByDay(attempts, now);
  const today = dayKey(now);
  const week = daysBack(now, 7);
  const fortnight = daysBack(now, 14);
  const weekTotal = week.reduce((sum, date) => sum + (counts.get(dayKey(date)) || 0), 0);
  const scored = attempts.filter((attempt) => attempt.source !== "manual");
  const averagePool = attempts.length ? attempts : [];
  const average = averagePool.length
    ? Math.round(averagePool.reduce((sum, attempt) => sum + attempt.score, 0) / averagePool.length)
    : null;
  return {
    todayCount: counts.get(today) || 0,
    todayLabel: `${now.getMonth() + 1}월 ${now.getDate()}일 (${WEEKDAYS[now.getDay()]})`,
    streak: streakEnding(counts, now),
    weekTotal,
    week: week.map((date) => ({
      key: dayKey(date),
      label: WEEKDAYS[date.getDay()],
      day: date.getDate(),
      count: counts.get(dayKey(date)) || 0,
      today: dayKey(date) === today,
    })),
    fortnight: fortnight.map((date) => ({
      key: dayKey(date),
      label: String(date.getDate()),
      count: counts.get(dayKey(date)) || 0,
      today: dayKey(date) === today,
    })),
    average,
    recognitionCount: scored.length,
  };
}

export function reviewSentences(progress, limit = 3) {
  const rows = [];
  for (const [sentenceId, record] of Object.entries(progress?.sentences || {})) {
    if (typeof record?.bestScore !== "number") continue;
    const found = findSentence(sentenceId);
    if (!found) continue;
    rows.push({ ...found, bestScore: record.bestScore });
  }
  rows.sort((a, b) => a.bestScore - b.bestScore || a.sentence.id.localeCompare(b.sentence.id));
  return rows.filter((row) => row.bestScore < 90).slice(0, limit);
}

export function mistakeSounds(progress, limit = 5) {
  const tally = new Map();
  for (const attempt of listAttempts(progress)) {
    if (attempt.source === "manual" || !attempt.recognized) continue;
    const found = findSentence(attempt.sentenceId);
    if (!found) continue;
    const evaluation = evaluateAttempt(found.sentence, attempt.recognized);
    const pieces = evaluation.compareTarget || [];
    if (found.sentence.tokens) {
      for (const piece of pieces) {
        if (piece.status === "ok" || piece.status === "neutral") continue;
        for (const char of piece.text) {
          const known = char === "っ" ? "작은 っ" : char === "ー" ? "장음 ー" : char === "ん" ? "ん" : "";
          if (!known) continue;
          const token = found.sentence.tokens.find((item) => `${item.r || ""}${item.t || ""}`.includes(char));
          addSound(tally, known, known, token?.t || char);
        }
      }
    } else {
      for (const piece of evaluation.targetPieces || []) {
        if (piece.status !== "bad" && piece.status !== "miss") continue;
        const word = String(piece.text || "");
        const key = word.toLowerCase();
        if (!key || !/[a-z]/.test(key)) continue;
        const sound = /th/i.test(word) ? "th" : /^[rl]/i.test(word) ? word[0].toLowerCase() : word.toLowerCase();
        addSound(tally, sound, sound, word);
      }
    }
  }
  return [...tally.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

function addSound(tally, id, label, example) {
  const current = tally.get(id) || { id, label, count: 0, examples: [] };
  current.count += 1;
  if (example && !current.examples.includes(example) && current.examples.length < 3) current.examples.push(example);
  tally.set(id, current);
}

export function resumeIndex(lesson, progress) {
  const index = lesson.sentences.findIndex((sentence) => {
    const record = progress?.sentences?.[sentence.id];
    return !(typeof record?.bestScore === "number" && record.bestScore >= 80);
  });
  return index >= 0 ? index : 0;
}
