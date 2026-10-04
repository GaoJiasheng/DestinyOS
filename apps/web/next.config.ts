import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
  transpilePackages: ['@tianji/shared', '@tianji/engine', '@tianji/interpret', '@tianji/content'],
  serverExternalPackages: ['geo-tz'],
  // DESIGN-GAP: Bounded imports of up to 50 chart snapshots need more than Next.js's default 1MB action body.
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
  outputFileTracingIncludes: {
    '/*': [
      './resources/**/*',
      '../../packages/content/dist/*.json',
      './node_modules/geo-tz/data/**/*',
    ],
  },
  poweredByHeader: false,
};
export default createNextIntlPlugin('./i18n/request.ts')(config);
