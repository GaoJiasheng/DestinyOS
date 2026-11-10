/* global Response, self, caches, URL, fetch */
/* DESIGN-GAP: Explicit public-shell allowlist instead of caching authenticated Next HTML/RSC or API responses. */
const CACHE = 'tianji-public-shell-sw3-8dc75e37c814';
const SHELL = [
  '/offline/zh',
  '/offline/en',
  '/offline/zh-TW',
  '/offline/style.css',
  '/fonts/selection.json',
  '/fonts/fonts.css',
  '/fonts/fonts-body.css',
  '/fonts/noto-ui.woff2',
  '/fonts/wenkai-ui.woff2',
  '/art/brand/favicon.png',
  '/art/states/offline-small.webp',
];
self.addEventListener('install', (event) => {
  // Activate fixed workers immediately so a previously installed broken worker cannot keep failing navigations.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
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
  // Only the locale homes get an offline fallback. The bare root is left to the network because it redirects,
  // and a redirected response must never be returned for a navigation request (Chrome reports ERR_FAILED).
  if (request.mode === 'navigate' && /^\/(?:zh-TW|zh|en)\/?$/.test(url.pathname)) {
    const fallback = url.pathname.startsWith('/zh-TW')
      ? '/offline/zh-TW'
      : url.pathname.startsWith('/en')
        ? '/offline/en'
        : '/offline/zh';
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.redirected) return Response.redirect(response.url, 302);
          // 4xx (including an edge 429) is a real answer for the visitor; only an unreachable origin shows the shell.
          if (response.status >= 500) throw new Error('Home unavailable');
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(fallback);
          if (!cached) return Response.error();
          // Shells cached before the extensionless URLs carry redirected=true, which Chrome rejects for navigations.
          return cached.redirected
            ? new Response(await cached.blob(), { status: 200, headers: cached.headers })
            : cached;
        }),
    );
    return;
  }
  // DESIGN-GAP: Large install icons and paintings cache only when requested, keeping duplicate PNG icons and fallback images out of the initial transfer budget.
  const art =
    /^\/art\/(?:brand|states|systems|hero|spreads|tarot|daily|share|charts)\/[a-z0-9-]+\.(?:webp|png|ico)$/.test(
      url.pathname,
    );
  if (
    SHELL.includes(url.pathname) ||
    art ||
    /^\/(?:fonts\/[a-z0-9-]+\.woff2|icons\/[a-z0-9-]+\.png)$/.test(url.pathname)
  ) {
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

// B-04 web push. Appended listeners only: install / activate / fetch above are untouched.
// The payload is the generic JSON built by lib/web-push-schedule.ts and never carries personal data.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' && data.title ? data.title : '天机 DestinyOS';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: typeof data.tag === 'string' ? data.tag : 'daily-reminder',
      data: { url: typeof data.url === 'string' ? data.url : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  // Same-origin site paths only: one leading slash, never a scheme or protocol-relative URL.
  const path = typeof raw === 'string' && /^\/(?![/\\])/.test(raw) ? raw : '/';
  const target = new URL(path, self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const open = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(target.href);
      await open.focus();
      if (open.url === target.href) return undefined;
      // navigate() rejects for a tab this worker does not control; fall back to a fresh window.
      return open.navigate(target.href).catch(() => self.clients.openWindow(target.href));
    }),
  );
});
