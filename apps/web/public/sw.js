/* global Response, self, caches, URL, fetch, Headers */
/* DESIGN-GAP: Explicit public-shell allowlist instead of caching authenticated Next HTML/RSC or API responses. */
const CACHE = 'tianji-public-shell-03859467c8dd';
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
            .filter(
              (key) =>
                (key.startsWith('tianji-public-shell-') && key !== CACHE) ||
                (key.startsWith('tianji-offline-reports-') && key !== OFFLINE),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
// DESIGN-GAP: Device reports (/r/local/{id}) render from browser storage, so one anonymous page per locale and
// system, plus the history list, reopens any of them offline. Pages ask for this from components/pwa/use-offline-shell.ts.
const OFFLINE = 'tianji-offline-reports-v1';
const OFFLINE_MESSAGE = 'tianji-offline-shell';
const MANIFEST = '/__offline/manifest.json';
// The server renders the same page for every local id; this placeholder is swapped for the requested id offline.
const PLACEHOLDER = '00000000-0000-4000-8000-00000ff11e00';
// One page fetch per locale and system every few hours keeps the shell current without adding rate-limited requests.
const SHELL_TTL = 6 * 3600 * 1000;
const MAX_SHELLS = 40;
const MAX_ASSETS = 400;

/** Offline-capable page for a path: device reports and the device history list only. */
function offlineRoute(pathname) {
  const report = /^\/(zh-TW|zh|en)\/([a-z]+)\/r\/local\/([A-Za-z0-9_-]{1,80})\/?$/.exec(pathname);
  if (report)
    return {
      key: `/__offline/shell/${report[1]}/${report[2]}`,
      source: `/${report[1]}/${report[2]}/r/local/${PLACEHOLDER}`,
      id: report[3],
      locale: report[1],
    };
  const history = /^\/(zh-TW|zh|en)\/me\/history\/?$/.exec(pathname);
  if (history)
    return {
      key: `/__offline/shell/${history[1]}/history`,
      source: `/${history[1]}/me/history`,
      id: null,
      locale: history[1],
    };
  return null;
}

/** Static files a cached page may need: hashed Next assets, fonts, paintings and tarot cards. */
function offlineAsset(pathname) {
  return /^\/(?:_next\/static\/[\w.~%@()[\]/-]+|fonts\/[a-z0-9-]+\.(?:woff2|css)|art\/[a-z0-9/-]+\.(?:webp|png|svg|ico)|tarot\/[a-z0-9/_-]+\.(?:webp|png|jpg|svg))$/.test(
    pathname,
  );
}

/** Chunks and stylesheets a page names in its markup or Flight data, including client references loaded on hydration. */
function shellAssets(html) {
  const found = new Set();
  for (const match of html.matchAll(
    /(?:\/_next\/)?(static\/(?:chunks|css|media)\/[\w.~%@()[\]/-]+)/g,
  ))
    found.add(`/_next/${match[1]}`);
  for (const match of html.matchAll(/\/fonts\/[a-z0-9-]+\.(?:woff2|css)/g)) found.add(match[0]);
  return [...found].filter(offlineAsset);
}

/** Same-origin static paths from page-reported resource URLs; anything else is dropped. */
function postedAssets(list) {
  if (!Array.isArray(list)) return [];
  const paths = [];
  for (const item of list.slice(0, MAX_ASSETS)) {
    if (typeof item !== 'string') continue;
    try {
      const url = new URL(item, self.location.origin);
      if (url.origin === self.location.origin && offlineAsset(url.pathname))
        paths.push(url.pathname + url.search);
    } catch {
      /* Not a URL. */
    }
  }
  return paths;
}

/** Restore the requested id so markup, Flight data and links all describe the address the visitor opened. */
function personalize(html, id) {
  return id ? html.split(PLACEHOLDER).join(id) : html;
}

let queue = Promise.resolve();
/** Manifest updates run one at a time so concurrent pages cannot drop each other's entries. */
function serialize(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readManifest(cache) {
  try {
    const response = await cache.match(MANIFEST);
    const data = response ? await response.json() : null;
    if (data && typeof data.shells === 'object' && data.shells) return data;
  } catch {
    /* A damaged manifest is rebuilt. */
  }
  return { shells: {} };
}

async function storeAssets(cache, paths) {
  const missing = [];
  for (const path of paths) if (!(await cache.match(path))) missing.push(path);
  // Four at a time: these are usually HTTP-cache hits, and rate limiting already exempts static paths.
  for (let i = 0; i < missing.length; i += 4)
    await Promise.all(
      missing.slice(i, i + 4).map(async (path) => {
        try {
          const response = (await caches.match(path)) || (await fetch(path));
          if (response.ok && response.type === 'basic') await cache.put(path, response.clone());
        } catch {
          /* The next visit retries. */
        }
      }),
    );
}

async function fetchShell(cache, route) {
  // Never the visitor's own response: credentials are omitted so the stored page carries no account state.
  const response = await fetch(route.source, { credentials: 'omit', cache: 'no-store' });
  const type = response.headers.get('content-type') || '';
  if (
    !response.ok ||
    response.redirected ||
    response.type !== 'basic' ||
    !type.includes('text/html')
  )
    return null;
  const html = await response.text();
  const assets = shellAssets(html);
  await storeAssets(cache, assets);
  const headers = new Headers(response.headers);
  for (const name of ['content-length', 'content-encoding', 'set-cookie']) headers.delete(name);
  await cache.put(route.key, new Response(html, { status: 200, headers }));
  return assets;
}

async function rememberShell(route, posted, refresh) {
  const cache = await caches.open(OFFLINE);
  const manifest = await readManifest(cache);
  const entry = manifest.shells[route.key];
  let assets = entry && Array.isArray(entry.assets) ? entry.assets : null;
  let at = entry && typeof entry.at === 'number' ? entry.at : 0;
  let collect = false;
  if (refresh && Date.now() - at > SHELL_TTL) {
    const fresh = await fetchShell(cache, route);
    if (fresh) {
      // A new page replaces the old asset list, so chunks from an earlier deploy become collectable.
      collect = Boolean(assets);
      assets = fresh;
      at = Date.now();
    }
  }
  if (!assets) return;
  const known = new Set(assets);
  const added = posted.filter((path) => !known.has(path));
  await storeAssets(cache, added);
  manifest.shells[route.key] = { at, assets: [...assets, ...added].slice(0, MAX_ASSETS) };
  const keys = Object.keys(manifest.shells).sort(
    (a, b) => manifest.shells[b].at - manifest.shells[a].at,
  );
  for (const key of keys.slice(MAX_SHELLS)) {
    delete manifest.shells[key];
    await cache.delete(key);
    collect = true;
  }
  await cache.put(
    MANIFEST,
    new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }),
  );
  if (!collect) return;
  const referenced = new Set(Object.values(manifest.shells).flatMap((shell) => shell.assets));
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/__offline/') && !referenced.has(url.pathname + url.search))
      await cache.delete(request);
  }
}

async function offlineShell(route) {
  const cached = await (await caches.open(OFFLINE)).match(route.key);
  if (!cached) return null;
  return new Response(personalize(await cached.text(), route.id), {
    status: 200,
    headers: cached.headers,
  });
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== OFFLINE_MESSAGE || typeof data.path !== 'string') return;
  const source = event.source;
  if (!source || typeof source.url !== 'string') return;
  if (new URL(source.url).origin !== self.location.origin) return;
  const route = offlineRoute(data.path);
  if (!route) return;
  const refresh = data.shell === true;
  const assets = postedAssets(data.assets);
  // Pages warming shells for other systems (components/pwa/offline-warmup.ts) wait on this port so they
  // send one page request at a time.
  const reply = event.ports && event.ports[0];
  event.waitUntil(
    serialize(async () => {
      await rememberShell(route, assets, refresh);
      // A report visit also keeps that language's history list, the way back to every other report.
      if (refresh && route.id)
        await rememberShell(offlineRoute(`/${route.locale}/me/history`), [], true);
    })
      .catch(() => undefined)
      .then(() => {
        if (reply) reply.postMessage(true);
      }),
  );
});

/** The locale's public offline page, made acceptable as a navigation response. */
async function publicShell(pathname) {
  const fallback = pathname.startsWith('/zh-TW')
    ? '/offline/zh-TW'
    : pathname.startsWith('/en')
      ? '/offline/en'
      : '/offline/zh';
  const cached = await caches.match(fallback);
  if (!cached) return Response.error();
  // Shells cached before the extensionless URLs carry redirected=true, which Chrome rejects for navigations.
  return cached.redirected
    ? new Response(await cached.blob(), { status: 200, headers: cached.headers })
    : cached;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Only the locale homes get an offline fallback. The bare root is left to the network because it redirects,
  // and a redirected response must never be returned for a navigation request (Chrome reports ERR_FAILED).
  if (request.mode === 'navigate' && /^\/(?:zh-TW|zh|en)\/?$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.redirected) return Response.redirect(response.url, 302);
          // 4xx (including an edge 429) is a real answer for the visitor; only an unreachable origin shows the shell.
          if (response.status >= 500) throw new Error('Home unavailable');
          return response;
        })
        .catch(() => publicShell(url.pathname)),
    );
    return;
  }
  // Device reports and their history stay network-first; the stored anonymous page answers only when the origin cannot.
  // Their Flight (RSC) requests are left alone: a failed one makes Next fall back to this document navigation.
  const route = request.mode === 'navigate' ? offlineRoute(url.pathname) : null;
  if (route) {
    const fallback = async () => (await offlineShell(route)) || publicShell(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => (response.status >= 500 ? fallback() : response))
        .catch(fallback),
    );
    return;
  }
  // Hashed Next assets and tarot cards are served from the offline store when a report page saved them.
  if (/^\/(?:_next\/static|tarot)\//.test(url.pathname)) {
    event.respondWith(
      caches
        .open(OFFLINE)
        .then((cache) => cache.match(request))
        .then((cached) => cached || fetch(request)),
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
        // Offline, a copy kept for a device report (see storeAssets) still answers.
        const response = await fetch(request).catch(async () => {
          const kept = await caches.match(request);
          if (kept) return kept;
          throw new Error('Asset unavailable');
        });
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
