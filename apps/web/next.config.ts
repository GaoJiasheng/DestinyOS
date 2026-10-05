import type { NextConfig } from 'next';
import { resolve } from 'node:path';
import { securityHeaders } from './lib/security-headers';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
  transpilePackages: ['@tianji/shared', '@tianji/engine', '@tianji/interpret', '@tianji/content'],
  serverExternalPackages: ['geo-tz'],
  // DESIGN-GAP: Bounded imports of up to 50 chart snapshots need more than Next.js's default 1MB action body.
  // DESIGN-GAP: Bound static generation to two workers on shared CI hosts; content and request behavior are unchanged.
  experimental: { cpus: 2, serverActions: { bodySizeLimit: '8mb' } },
  // DESIGN-GAP: Vercel's app root is apps/web; trace the monorepo so deployed functions retain shared knowledge and fixtures.
  outputFileTracingRoot: resolve(__dirname, '../..'),
  outputFileTracingIncludes: {
    '/*': [
      './resources/**/*',
      './node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff',
      './node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff',
      '../../packages/content/dist/*.json',
      '../../packages/content/test/fixtures/*.json',
      '../../packages/engine/test/fixtures/birth/*.json',
      './node_modules/geo-tz/data/**/*',
    ],
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
