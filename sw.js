const CACHE_VERSION = "v3";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;

// Only cache same-origin static assets. Do not cache Google API responses.
const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/css/app.css",
  "/js/app.js",
  "/js/sheets.js",
  "/js/inventory.js",
  "/js/assignments.js",
  "/src/components/index.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("app-shell-") && k !== APP_SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Strategy:
// - For navigation/HTML requests: network-first with cache fallback
// - For same-origin static assets: cache-first
// - Ignore cross-origin (e.g., Google APIs) to avoid caching OAuth responses
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigation requests: network-first
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const resClone = res.clone();
          caches
            .open(APP_SHELL_CACHE)
            .then((cache) => cache.put("/index.html", resClone))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Only cache same-origin assets
  if (!sameOrigin) return;

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          const resClone = res.clone();
          caches
            .open(APP_SHELL_CACHE)
            .then((cache) => cache.put(request, resClone))
            .catch(() => {});
          return res;
        })
        .catch(() => cached);
    })
  );
});
