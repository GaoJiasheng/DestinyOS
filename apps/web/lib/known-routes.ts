import { systems } from './system-links';

const system = `(?:${systems.join('|')})`;
// DESIGN-GAP: The locale layout streams its loading shell with a 200 before a page can call notFound(), so unknown localized paths were soft 404s. The middleware answers them itself from this list; test/known-routes.test.ts fails when a page.tsx is added without updating it.
const known = new RegExp(
  `^(?:` +
    [
      '',
      '/today(?:/calendar)?',
      `/${system}`,
      `/${system}/new`,
      `/${system}/r/[^/]+(?:/chat|/print)?`,
      `/${system}/r/local/[^/]+`,
      '/iching/cast',
      '/tarot/reading',
      '/rectify',
      '/age-restricted',
      '/me(?:/(?:billing|birth|history|journal|profiles|settings))?',
      '/auth/(?:login|verify)',
      '/(?:about|contact|credits|disclaimer|faq|pricing|privacy|terms)',
      // Encyclopedia paths are checked against the generated corpus list before this one.
      '/learn(?:/.*)?',
      '/dev/tokens',
      '/404',
    ].join('|') +
    `)$`,
);

/** Whether a locale-relative path (no locale prefix, no trailing slash) is served by a page. */
export function isKnownRoute(path: string): boolean {
  return known.test(path);
}
