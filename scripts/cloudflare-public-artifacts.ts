import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publicCacheRequest } from '../apps/web/lib/platform/public-cache';
const web = resolve(import.meta.dirname, '../apps/web');
const manifest = JSON.parse(
  await readFile(resolve(web, '.next/prerender-manifest.json'), 'utf8'),
) as { routes: Record<string, unknown> };
const registry: Record<string, { html: string; rsc: string }> = {};
// DESIGN-GAP: Only statically generated, allowlisted public pages enter the fast path; all actions/dynamic/private routes retain the full application.
for (const route of Object.keys(manifest.routes)) {
  if (!publicCacheRequest(new Request(`https://build.internal${route}`))) continue;
  const files = { html: `/_data/pages${route}.html`, rsc: `/_data/pages${route}.rsc` };
  for (const [kind, asset] of Object.entries(files)) {
    const target = resolve(web, '.open-next/assets', `.${asset}`);
    await mkdir(resolve(target, '..'), { recursive: true });
    await cp(resolve(web, '.next/server/app', `${route.slice(1)}.${kind}`), target);
  }
  registry[route] = files;
}
await writeFile(resolve(web, '.open-next/public-artifacts.json'), JSON.stringify(registry) + '\n');
console.log(`Prepared ${Object.keys(registry).length} public HTML/Flight snapshots.`);
