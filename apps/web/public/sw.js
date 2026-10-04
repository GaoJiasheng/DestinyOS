/* global self, caches, URL, fetch */
/* DESIGN-GAP: Explicit public-shell allowlist instead of caching authenticated Next HTML/RSC or API responses. */
const CACHE = 'tianji-public-shell-c64ec96567f0';
const SHELL = [
  '/offline/zh.html',
  '/offline/en.html',
  '/offline/style.css',
  '/fonts/selection.json',
  '/fonts/fonts.css',
  '/fonts/fonts-body.css',
  '/fonts/noto-ui.woff2',
  '/fonts/wenkai-ui.woff2',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tianji-public-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && /^\/(?:zh|en)?\/?$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.ok) throw new Error('Home unavailable');
          return response;
        })
        .catch(() =>
          caches.match(url.pathname.startsWith('/en') ? '/offline/en.html' : '/offline/zh.html'),
        ),
    );
    return;
  }
  if (SHELL.includes(url.pathname) || /^\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
