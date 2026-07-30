const CACHE_NAME = "elite-driver-manager-v1";

const urlsToCache = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/register.html",
  "/css/style.css",
  "/js/language.js",
  "/images/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});