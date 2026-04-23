/// <reference types="@sveltejs/kit" />
import { build, files, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `mq-${version}`;
// `build` = hashed immutable bundles, `files` = contents of /static/.
// questions.json lives in /static via the symlink, so it's already in `files`.
// "/" is the SPA fallback HTML — SvelteKit doesn't include it in either list,
// so we fetch+cache it explicitly on install for the navigation fallback.
const PRECACHE = [...build, ...files, "/"];

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => sw.clients.claim()),
  );
});

sw.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "SKIP_WAITING") {
    sw.skipWaiting();
  }
});

sw.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin (PocketBase, analytics, anything) — let the network handle it.
  if (url.origin !== location.origin) return;

  // Hashed immutable bundles: cache-first — they never change for a given URL.
  if (url.pathname.startsWith("/_app/immutable/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Data + mutable assets: serve cached copy fast, refresh in background.
  if (url.pathname === "/questions.json" || url.pathname.startsWith("/assets/")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Navigations / HTML: try network, fall back to cached index.
  if (req.mode === "navigate") {
    event.respondWith(navigationFallback(req));
  }
});

async function cacheFirst(req: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const networked = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit ?? (await networked) ?? Response.error();
}

async function navigationFallback(req: Request): Promise<Response> {
  try {
    return await fetch(req);
  } catch {
    const cache = await caches.open(CACHE);
    const fallback = await cache.match("/");
    return fallback ?? Response.error();
  }
}
