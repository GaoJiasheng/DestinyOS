import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue';
import incrementalCache from './lib/platform/incremental-cache';
// DESIGN-GAP: Cache interception skips NextServer on ISR hits; the existing self-reference binding handles bounded background revalidation without new remote resources.
const config = defineCloudflareConfig({
  incrementalCache,
  enableCacheInterception: true,
  queue: memoryQueue,
});
// DESIGN-GAP: Build the full workspace corpus before adapting Next; never deploy a stale content bundle.
config.buildCommand = 'pnpm --dir ../.. content:build && pnpm build';
export default config;
