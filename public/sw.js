const VERSION = "stellantis-cockpit-offline-v1";
const SHELL = [
  "/offline.html",
  "/model-wise/jeep",
  "/model-wise/citroen",
  "/industry",
  "/budget-planning",
  "/data-entry",
  "/stellantis-network",
  "/manufacturer-history"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(async (path) => {
      try {
        const response = await fetch(path, { cache: "reload" });
        if (response.ok && response.type === "basic") await cache.put(path, response);
      } catch {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("stellantis-cockpit-") && key !== VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(url.pathname) || await cache.match(url.pathname.replace(/\/$/, ""));
        return cached || await cache.match("/offline.html") || new Response("You are offline. Open the app while online once to cache its pages and data.", {
          status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return cached || Response.error();
      }
    })());
  }
});
