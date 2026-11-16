export function parseHash(hash) {
  const parts = String(hash || "")
    .replace(/^#/, "")
    .split("/")
    .filter(Boolean);
  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "stats") return { name: "stats" };
  if (parts[0] === "lessons") {
    return {
      name: "lessons",
      trackId: parts[1] ? decodeURIComponent(parts[1]) : null,
      lessonId: parts[2] ? decodeURIComponent(parts[2]) : null,
    };
  }
  if (parts[0] === "track" && parts[1]) return { name: "lessons", trackId: decodeURIComponent(parts[1]), lessonId: null };
  if (parts[0] === "practice" && parts[1] && parts[2]) {
    const index = Number.parseInt(parts[3] ?? "0", 10);
    return {
      name: "practice",
      trackId: decodeURIComponent(parts[1]),
      lessonId: decodeURIComponent(parts[2]),
      index: Number.isFinite(index) ? index : 0,
    };
  }
  return { name: "home" };
}

export function practiceHash(trackId, lessonId, index) {
  return `#/practice/${encodeURIComponent(trackId)}/${encodeURIComponent(lessonId)}/${index}`;
}

export function trackHash(trackId) {
  return `#/lessons/${encodeURIComponent(trackId)}`;
}

export function lessonsHash(trackId, lessonId) {
  const base = `#/lessons/${encodeURIComponent(trackId)}`;
  return lessonId ? `${base}/${encodeURIComponent(lessonId)}` : base;
}

export function statsHash() {
  return "#/stats";
}
