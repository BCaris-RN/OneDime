const CACHE = "onedime-static-v1";
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/styles.css",
  "/fonts.css",
  "/app.js",
  "/smart-worker.js",
  "/smart-model.json",
  "/icons/coin-192.png",
  "/icons/coin-512.png",
  "/fonts/jetbrains-mono-latin-600-normal.woff2",
  "/fonts/jetbrains-mono-latin-800-normal.woff2",
  "/fonts/atkinson-hyperlegible-latin-400-normal.woff2",
  "/fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "/fonts/source-code-pro-latin-800-normal.woff2",
  "/vendor/ort/ort-wasm-simd-threaded.asyncify.mjs",
  "/vendor/ort/ort-wasm-simd-threaded.asyncify.wasm"
];
const CACHEABLE_PREFIXES = ["/fonts/", "/models/", "/vendor/ort/"];
const CACHEABLE_FILES = new Set(PRECACHE);
function isStaticAsset(path) {
  return CACHEABLE_FILES.has(path) || CACHEABLE_PREFIXES.some(prefix => path.startsWith(prefix));
}
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("onedime-static-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/app") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put("/app", copy)));
      }
      return response;
    }).catch(async () => (await caches.match("/app")) ?? (await caches.match("/offline.html"))));
    return;
  }
  if (isStaticAsset(url.pathname)) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
      }
      return response;
    }).catch(async () => (await caches.open(CACHE).then(cache => cache.match(request))) ?? Response.error()));
    return;
  }
  if (request.mode === "navigate")
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) ?? Response.error()));
});
