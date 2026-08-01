const CACHE_NAME = "elite-driver-manager-v2";

const urlsToCache = [
  './',
  'index.html',
  'dashboard.html',
  'register.html',
  'css/style.css',
  'js/language.js',
  'images/logo.png'
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use requests without leading slash so paths work when the site is hosted on a subpath (e.g. GitHub Pages)
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("activate", (event) => {
  // Cleanup any old caches when activating a new service worker
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Network-first for CSS/JS so updates are picked up quickly, cache-first for others
  const requestURL = new URL(event.request.url);
  if (requestURL.pathname.endsWith('.css') || requestURL.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with the latest copy
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response when available, otherwise fall back to network
      return response || fetch(event.request).catch(() => {
        // If request fails (offline) and it's a navigation, serve index.html as fallback
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
