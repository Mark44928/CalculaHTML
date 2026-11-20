// Bump when the shell files below change, so clients pick up the new version
// instead of serving a stale cache forever.
const CACHE_NAME = "calculahtml-v15";
const SHELL = [
  "./",
  "./?source=pwa",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/favicon-32.png",
  "./offline.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("calculahtml-") && k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
    ])
  );
});

// Same-origin GET responses are refreshed into the cache; the network fetch is
// wrapped in event.waitUntil so the worker stays alive until the cache write
// lands. Firing cache.put without waitUntil let the worker be killed first,
// leaving clients on a stale shell forever.
function refreshCache(event, request, res) {
  const copy = res.clone();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
  );
}

function cacheable(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    // Stale-while-revalidate: serve the cached shell immediately (this is what
    // makes the offline-capable promise true), refresh it in the background.
    // Previously this was fetch-first, so opening the installed app offline
    // showed offline.html instead of the calculator itself.
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (cacheable(request) && res.ok) refreshCache(event, request, res);
            return res;
          })
          .catch(() => cached || caches.match("./offline.html"));
        event.waitUntil(network.catch(() => null));
        return cached || network;
      })
    );
    return;
  }
  event.respondWith(
    fetch(request).then((res) => {
      if (cacheable(request) && res.ok) refreshCache(event, request, res);
      return res;
    }).catch(() => caches.match(request))
  );
});
