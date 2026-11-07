// Offline support: keeps a copy of the app so it opens without a connection.
// Files are served from the copy straight away and refreshed in the background,
// so a change shows up the second time you open the app. Bump VERSION when files are added.
const VERSION = "pt-b1-v1";
const FILES = [
  "./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "data/plan.json", "data/phrases.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Only this app's own files; never the Mac voice server (/say) or other sites.
  if (e.request.method !== "GET" || url.origin !== location.origin || /\/say(\/|$)/.test(url.pathname)) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request)
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      if (cached) { e.waitUntil(fresh); return cached; }
      return fresh;
    }),
  );
});
