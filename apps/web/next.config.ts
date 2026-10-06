import type { NextConfig } from 'next';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { securityHeaders } from './lib/security-headers';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
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
    'opencc-js',
    'zod',
    '@sentry/nextjs',
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
      './messages/*/glossary.json',
      // DESIGN-GAP: Next traces Node export conditions; OpenNext selects Sentry's workerd edge entry, so explicitly trace its SDK dependency.
      './node_modules/@sentry/vercel-edge/**/*',
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
  webpack(config, { isServer, nextRuntime }) {
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
        'opencc-js/cn2t': 'commonjs opencc-js/cn2t',
        '@sentry/nextjs': 'commonjs @sentry/nextjs',
      });
    if (process.env.PLATFORM === 'cloudflare') {
      for (const module of [
        'browser-node',
        'storage-node',
        'logger-node',
        'png-node',
        'timezone-node',
        'db-local',
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
