/* Service Worker: offline cache + notification click handling */
const CACHE_NAME = "tb-cache-v4"; // bump to force clients (incl. Android PWA) to fetch latest assets
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/reset.css",
  "./css/variables.css",
  "./css/layout.css",
  "./css/calendar.css",
  "./css/tasks.css",
  "./css/responsive.css",
  "./js/app.js",
  "./js/utils.js",
  "./js/storage.js",
  "./js/tasks.js",
  "./js/audio.js",
  "./js/timer.js",
  "./assets/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // only cache GET
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          // Cache successful responses
          if (res && res.status === 200 && res.type === "basic") {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached || caches.match("./index.html"));
      return cached || fetchPromise;
    })
  );
});

// Notification click: focus/open client
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const url = "./index.html";
      for (const client of clientsArr) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});