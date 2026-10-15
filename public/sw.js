/* MenuPage service worker — keeps public menus available offline.
 * - Menu pages (/r/*, /site/*, /l/*): network first, cached copy when offline.
 * - Static assets (/_next/static, images, fonts): cache first.
 * - Never caches the dashboard, auth or API responses. */
const VERSION = "mp-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isMenuPage(url) {
  return /^\/(r|site|l)\//.test(url.pathname);
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === self.location.origin && isMenuPage(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy)).then(() => trim(PAGES, 20));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((hit) => hit || new Response("You're offline and this menu hasn't been saved yet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }))),
    );
    return;
  }

  const isStatic =
    (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/uploads/"))) ||
    req.destination === "image" ||
    req.destination === "font";
  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === "opaque") {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy)).then(() => trim(ASSETS, 200));
            }
            return res;
          }),
      ),
    );
  }
});
