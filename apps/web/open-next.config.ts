import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
const config = defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
// DESIGN-GAP: Build the full workspace corpus before adapting Next; never deploy a stale content bundle.
config.buildCommand = 'pnpm --dir ../.. content:build && pnpm build';
export default config;
