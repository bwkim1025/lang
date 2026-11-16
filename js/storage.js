export const STORAGE_KEY = "pronounce.progress.v1";
export const LEGACY_KEYS = ["pronounce.progress.v0"];
export const ATTEMPT_LIMIT = 5;

export function emptyProgress() {
  return {
    version: 1,
    speed: 0.8,
    current: null,
    sentences: {},
  };
}

function safeParse(raw) {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function hydrate(value) {
  const next = { ...value, version: 1 };
  if (typeof next.speed !== "number" || Number.isNaN(next.speed)) next.speed = 0.8;
  if (!next.sentences || typeof next.sentences !== "object" || Array.isArray(next.sentences)) {
    next.sentences = {};
  }
  if (next.current && typeof next.current !== "object") next.current = null;
  return next;
}

export function loadProgress(storage) {
  const currentRaw = storage.getItem(STORAGE_KEY);
  if (currentRaw != null) {
    const parsed = safeParse(currentRaw);
    return parsed ? hydrate(parsed) : emptyProgress();
  }
  for (const key of LEGACY_KEYS) {
    const legacyRaw = storage.getItem(key);
    if (legacyRaw == null) continue;
    const parsed = safeParse(legacyRaw);
    if (!parsed) continue;
    const migrated = hydrate(parsed);
    storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }
  return emptyProgress();
}

export function saveProgress(storage, progress) {
  const next = {
    ...progress,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function recordAttempt(progress, sentenceId, attempt, limit = ATTEMPT_LIMIT) {
  const prev = progress.sentences?.[sentenceId] && typeof progress.sentences[sentenceId] === "object"
    ? progress.sentences[sentenceId]
    : {};
  const prevAttempts = Array.isArray(prev.attempts) ? prev.attempts : [];
  const attempts = [...prevAttempts, attempt].slice(-limit);
  const prevBest = typeof prev.bestScore === "number" ? prev.bestScore : null;
  const bestScore = prevBest == null ? attempt.score : Math.max(prevBest, attempt.score);
  return {
    ...progress,
    sentences: {
      ...progress.sentences,
      [sentenceId]: {
        ...prev,
        bestScore,
        attempts,
      },
    },
  };
}

export function summarize(ids, progress) {
  let practiced = 0;
  let sum = 0;
  let count = 0;
  let mastered = 0;
  for (const id of ids) {
    const record = progress.sentences?.[id];
    const attempts = Array.isArray(record?.attempts) ? record.attempts : [];
    if (attempts.length) practiced += 1;
    if (typeof record?.bestScore === "number") {
      sum += record.bestScore;
      count += 1;
      if (record.bestScore >= 80) mastered += 1;
    }
  }
  return {
    practiced,
    total: ids.length,
    average: count ? Math.round(sum / count) : null,
    mastered,
  };
}
