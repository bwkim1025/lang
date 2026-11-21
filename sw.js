const CACHE = "pronounce-shell-v5";

const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./js/app.js",
  "./js/data.js",
  "./js/diff.js",
  "./js/kana.js",
  "./js/route.js",
  "./js/speech.js",
  "./js/stats.js",
  "./js/storage.js",
  "./js/take.js",
  "./icons/favicon.ico",
  "./icons/icon.svg",
  "./icons/favicon-32.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./fonts/NotoSansJP-Regular.woff2",
  "./fonts/gothic-a1-korean-400.woff2",
  "./fonts/gothic-a1-latin-400.woff2",
  "./fonts/noto-sans-latin-400.woff2",
  "./fonts/noto-sans-latin-ext-400.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => /^pronounce-shell-v\d+$/.test(key) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  event.respondWith(fromCacheOrNetwork(request));
});

async function fromCacheOrNetwork(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && !response.redirected) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    if (request.mode === "navigate") {
      return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
    }
    // The shell keeps a regular face per script; extra weights are cached on first use.
    const font = new URL(request.url).pathname.match(/\/fonts\/((?:gothic-a1-(?:korean|latin)|noto-sans-(?:latin|latin-ext)))-(?:500|600|700|800)\.woff2$/);
    if (font) {
      const regular = await cache.match(`./fonts/${font[1]}-400.woff2`);
      if (regular) return regular;
    }
    throw error;
  }
}
