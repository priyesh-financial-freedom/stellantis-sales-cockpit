const VERSION = "stellantis-cockpit-offline-v1";
const SHELL = [
  "/offline.html",
  "/model-wise/jeep",
  "/model-wise/citroen",
  "/industry",
  "/industry/manufacturers",
  "/budget-planning",
  "/data-entry",
  "/stellantis-network"
];

async function cachePageAndAssets(cache, path, response) {
  await cache.put(path, response.clone());
  try {
    const html = await response.clone().text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]*\\/_next\\/static\\/[^"]+)"/g)]
      .map(match => new URL(match[1], self.location.origin))
      .filter(url => url.origin === self.location.origin);
    await Promise.all([...new Set(assets.map(url => url.href))].map(async href => {
      try {
        const asset = await fetch(href);
        if (asset.ok) await cache.put(href, asset);
      } catch {}
    }));
  } catch {}
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(async (path) => {
      try {
        const response = await fetch(path, { cache: "reload" });
        if (response.ok && response.type === "basic") await cachePageAndAssets(cache, path, response);
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
          await cachePageAndAssets(cache, url.pathname, response);
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
