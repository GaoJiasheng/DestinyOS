import type { NextConfig } from 'next';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { securityHeaders } from './lib/security-headers';
import createNextIntlPlugin from 'next-intl/plugin';
interface EntryCompilation {
  entrypoints: Map<string, { getFiles(): string[] }>;
  emitAsset(name: string, source: unknown): void;
  hooks: {
    processAssets: { tap(options: { name: string; stage: number }, run: () => void): void };
  };
}
interface EntryCompiler {
  hooks: {
    thisCompilation: { tap(name: string, run: (compilation: EntryCompilation) => void): void };
  };
}
// DESIGN-GAP: next-intl's experimental precompile loader nests dotted keys and rejects our flat catalogs (toMessages owns that expansion); take only its parser-free runtime and compile on the server instead (i18n/client-provider.tsx).
const formatOnly = resolve(__dirname, 'i18n/format-message.ts');
const config: NextConfig = {
  // DESIGN-GAP: Static Flight file transport is enabled only for the Workers build, preserving local Node development.
  env: { NEXT_PUBLIC_STATIC_ASSETS: process.env.PLATFORM === 'cloudflare' ? 'true' : 'false' },
  transpilePackages: [
    '@tianji/shared',
    '@tianji/engine',
    '@tianji/interpret',
    '@tianji/content',
    '@tianji/ui-core',
    '@tianji/api-client',
  ],
  serverExternalPackages: [
    // DESIGN-GAP: Let OpenNext bundle shared libraries once instead of duplicating them in Next's RSC and SSR chunks; browser bundles keep their normal imports.
    'lunar-typescript',
    'astronomy-engine',
    '@js-temporal/polyfill',
    'zod',
    'geo-tz',
    'playwright-core',
    '@sparticuz/chromium',
    'sharp',
    '@prisma/client',
    '.prisma/client',
    '@prisma/adapter-better-sqlite3',
    'better-sqlite3',
    '@cloudflare/puppeteer',
  ],
  // DESIGN-GAP: Bounded imports of up to 50 chart snapshots need more than Next.js's default 1MB action body.
  // DESIGN-GAP: Bound static generation to two workers on shared CI hosts; content and request behavior are unchanged.
  experimental: { cpus: 2, serverActions: { bodySizeLimit: '8mb' } },
  // DESIGN-GAP: Vercel's app root is apps/web; trace the monorepo so deployed functions retain shared knowledge and fixtures.
  outputFileTracingRoot: resolve(__dirname, '../..'),
  outputFileTracingIncludes: {
    '/api/export': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    '/*': [
      './resources/**/*',
      './public/art/share/*.png',
      './public/art/systems/*.png',
      './public/art/brand/og-default.png',
      './messages/*/glossary.json',
      './lib/llm/prompts/*.md',
      './node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff',
      './node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff',
      '../../packages/content/dist/*.json',
      '../../packages/content/test/fixtures/*.json',
      '../../packages/engine/test/fixtures/birth/*.json',
      './node_modules/geo-tz/data/**/*',
    ],
  },
  // DESIGN-GAP: Exclude Node-only binaries from Workers bundles while preserving the Vercel build.
  webpack(config, { isServer, nextRuntime, webpack }) {
    // DESIGN-GAP: Next 16 no longer writes app-build-manifest.json; emit the same route-to-entry-chunks map so scripts/perf-budgets.ts keeps measuring exactly what it measured on Next 15.
    if (!isServer)
      config.plugins.push({
        apply(compiler: EntryCompiler) {
          compiler.hooks.thisCompilation.tap('AppEntryManifest', (compilation) =>
            compilation.hooks.processAssets.tap(
              {
                name: 'AppEntryManifest',
                stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
              },
              () => {
                const files = (name: string) =>
                  (compilation.entrypoints.get(name)?.getFiles() ?? []).filter((file) =>
                    file.endsWith('.js'),
                  );
                const main = files('main-app');
                const pages = Object.fromEntries(
                  [...compilation.entrypoints.keys()]
                    .filter((name) => name.startsWith('app/'))
                    .map((name) => [name.slice(3), [...main, ...files(name)]]),
                );
                compilation.emitAsset(
                  'app-build-manifest.json',
                  new webpack.sources.RawSource(JSON.stringify({ pages })),
                );
              },
            ),
          );
        },
      });
    // DESIGN-GAP: Browser and SSR format the same precompiled client catalogs, so both drop intl-messageformat; React Server Components keep the full ICU parser for request-config strings.
    if (!isServer) config.resolve.alias['use-intl/format-message$'] = formatOnly;
    else
      config.module.rules.push({
        issuerLayer: 'ssr',
        resolve: { alias: { 'use-intl/format-message$': formatOnly } },
      });
    // DESIGN-GAP: Public values are compiled into client code; isolate filesystem caches when E2E switches between configured ads and an unconfigured build.
    const publicConfig = createHash('sha256')
      .update(
        JSON.stringify(
          Object.entries(process.env)
            .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
            .sort(([a], [b]) => a.localeCompare(b)),
        ),
      )
      .digest('hex')
      .slice(0, 16);
    // DESIGN-GAP: Platform aliases differ; partition Webpack's filesystem caches so a Node build never reuses disabled Worker adapters.
    if (config.cache && typeof config.cache === 'object')
      config.cache.name = `${config.cache.name ?? 'next'}-${process.env.PLATFORM === 'cloudflare' ? 'cloudflare' : 'node'}-${publicConfig}`;
    // DESIGN-GAP: Next only externalizes RSC by default; these non-React libraries are safe to share with SSR too, so OpenNext can deduplicate their full datasets.
    if (isServer && nextRuntime === 'nodejs')
      config.externals.unshift({
        'lunar-typescript': 'commonjs lunar-typescript',
        'astronomy-engine': 'commonjs astronomy-engine',
        '@js-temporal/polyfill': 'commonjs @js-temporal/polyfill',
        zod: 'commonjs zod',
      });
    if (isServer)
      config.resolve.alias['@sentry/nextjs$'] = resolve(
        __dirname,
        'lib/platform/sentry-browser-only.ts',
      );
    if (process.env.PLATFORM === 'cloudflare') {
      for (const module of [
        'browser-node',
        'storage-node',
        'logger-node',
        'png-node',
        'timezone-node',
        'db-local',
        'og-card-render',
        'public-og-render',
        'export-render',
      ]) {
        // DESIGN-GAP: Webpack aliases match import requests before resolving files; the previous absolute-path aliases left Node adapters in the Worker.
        config.resolve.alias[`./${module}$`] = resolve(
          __dirname,
          'lib/platform/node-unavailable.ts',
        );
      }
    }
    return config;
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/.well-known/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      { source: '/:path*', headers: securityHeaders() },
      // DESIGN-GAP: Daily worker filenames contain their content hash, so immutable caching avoids revalidating the preload and every date-switch worker.
      {
        source: '/workers/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // DESIGN-GAP: Modern supported browsers decode Brotli over HTTPS/localhost; only build-time compressed workers receive this header, never the raw fallback files.
      {
        source: '/workers/br/:path*',
        headers: [{ key: 'Content-Encoding', value: 'br' }],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};
export default createNextIntlPlugin('./i18n/request.ts')(config);
