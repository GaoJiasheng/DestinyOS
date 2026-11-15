import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { isKnownRoute } from '../lib/known-routes';
import { webDirectory } from '../lib/platform/resources-node';

function pages(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      // Route groups add no URL segment.
      const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
      return pages(resolve(directory, entry.name), prefix + segment);
    }
    return entry.name === 'page.tsx' ? [prefix] : [];
  });
}

it('recognizes every localized page so the middleware never 404s a real route', () => {
  const routes = pages(resolve(webDirectory(), 'app/[locale]'))
    // The catch-all only renders the not-found page.
    .filter((route) => !route.includes('[...slug]'))
    .map((route) =>
      route
        .replace('[system]', 'bazi')
        .replace('[hexagram]', '1')
        .replace(/\[[^\]]+\]/g, 'sample-id'),
    );
  expect(routes.length).toBeGreaterThan(30);
  for (const route of routes) expect(isKnownRoute(route), route || '/').toBe(true);
});

it('rejects paths no page serves', () => {
  for (const path of [
    '/this-page-does-not-exist',
    '/a/b/c',
    '/today/xyz',
    '/me/xyz',
    '/bazi/r',
    '/unknown/new',
    '/bazi/r/abc/chat/extra',
  ])
    expect(isKnownRoute(path), path).toBe(false);
});
