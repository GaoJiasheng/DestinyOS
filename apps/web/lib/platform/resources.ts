import { nodeResourceBytes, nodeResourceNames } from './resources-node';
import { platform } from './environment';
import { cloudflareBindings } from './cloudflare';
// DESIGN-GAP: Both adapters share the existing build-time disk fallback; Workers request-time reads use Assets.
function readFromDisk(): boolean {
  return platform() !== 'cloudflare' || process.env.NEXT_PHASE === 'phase-production-build';
}
/** Read public build artifacts from Workers Assets, or traced files on Node/build-time generation. */
// DESIGN-GAP: Workers have no deployed disk; public corpus/font/prompt assets are copied under /_data by cf:build.
export async function resourceBytes(path: string): Promise<Buffer> {
  if (readFromDisk()) return nodeResourceBytes(path);
  const key = path.replace(/^\.\.\/\.\.\//, 'workspace/');
  const response = await (
    await cloudflareBindings()
  ).ASSETS.fetch(`https://assets.internal/_data/${key}`);
  if (!response.ok) throw new Error('Bundled resource unavailable');
  return Buffer.from(await response.arrayBuffer());
}
/** Decode a trusted public UTF-8 corpus or renderer prompt. */
export async function resourceText(path: string): Promise<string> {
  return (await resourceBytes(path)).toString('utf8');
}

/** Enumerate the frozen public fixture corpus on disk or using its build-time asset index. */
export async function resourceNames(path: string): Promise<string[]> {
  if (readFromDisk()) return nodeResourceNames(path);
  const names: unknown = JSON.parse(await resourceText(`${path}/_index.json`));
  if (!Array.isArray(names) || !names.every((name): name is string => typeof name === 'string'))
    throw new Error('Invalid resource index');
  return names;
}
