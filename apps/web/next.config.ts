import type { NextConfig } from 'next';
import { securityHeaders } from './lib/security-headers';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
  transpilePackages: ['@tianji/shared', '@tianji/engine', '@tianji/interpret', '@tianji/content'],
  serverExternalPackages: ['geo-tz'],
  // DESIGN-GAP: Bounded imports of up to 50 chart snapshots need more than Next.js's default 1MB action body.
  // DESIGN-GAP: Bound static generation to two workers on shared CI hosts; content and request behavior are unchanged.
  experimental: { cpus: 2, serverActions: { bodySizeLimit: '8mb' } },
  outputFileTracingIncludes: {
    '/*': [
      './resources/**/*',
      '../../packages/content/dist/*.json',
      './node_modules/geo-tz/data/**/*',
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }];
  },
};
export default createNextIntlPlugin('./i18n/request.ts')(config);
