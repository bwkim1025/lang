export function parseHash(hash) {
  const parts = String(hash || "")
    .replace(/^#/, "")
    .split("/")
    .filter(Boolean);
  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "track" && parts[1]) return { name: "track", trackId: decodeURIComponent(parts[1]) };
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
  return `#/track/${encodeURIComponent(trackId)}`;
}
