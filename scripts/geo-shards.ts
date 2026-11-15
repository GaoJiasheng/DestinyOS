import { buildGeoShards } from './geo-shards-build';
// Generated before web dev/build and Vitest; see apps/web/lib/geo-shard.ts for why the corpus is split.
const result = await buildGeoShards();
if (result.built) console.log(`Geo shards rebuilt: ${(result.bytes / 1e6).toFixed(1)}MB`);
