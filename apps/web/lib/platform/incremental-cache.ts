import r2 from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import assets from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';
// DESIGN-GAP: Keep writable R2 ISR, but fall back to this deployment's public prerendered Assets when a PoP/local R2 cache has not been populated. This also lets OpenNext intercept RSC without loading NextServer.
const get: typeof r2.get = async (key, cacheType) => {
  const value = await r2.get(key, cacheType);
  if (value || cacheType === 'fetch' || cacheType === 'composable') return value;
  const initial = await assets.get(key, cacheType);
  // DESIGN-GAP: Copied public content changes only with the deployment; a missing R2 entry must not trigger ISR generation of an immutable build artifact.
  return initial ? { ...initial, lastModified: Date.now() } : null;
};
export default {
  name: r2.name,
  get,
  set: r2.set.bind(r2),
  delete: r2.delete.bind(r2),
};
