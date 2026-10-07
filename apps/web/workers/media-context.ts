import { AsyncLocalStorage } from 'node:async_hooks';
import type { BrowserWorker } from '@cloudflare/puppeteer';
export interface MediaEnvironment {
  ASSETS: { fetch(request: Request | string): Promise<Response> };
  BROWSER: BrowserWorker;
  NEXT_PUBLIC_SITE_URL?: string;
}
export const mediaContext = new AsyncLocalStorage<MediaEnvironment>();
/** Resolve only this service invocation's bindings. */
export async function cloudflareBindings(): Promise<MediaEnvironment> {
  const env = mediaContext.getStore();
  if (!env) throw new Error('Media context missing');
  return env;
}
/** Read public font/art artifacts from this media deployment's Assets binding. */
export async function resourceBytes(path: string): Promise<Buffer> {
  const key = path.replace(/^\.\.\/\.\.\//, 'workspace/');
  const response = await (
    await cloudflareBindings()
  ).ASSETS.fetch(`https://assets.internal/_data/${key}`);
  if (!response.ok) throw new Error('Media asset unavailable');
  return Buffer.from(await response.arrayBuffer());
}
export async function resourceText(path: string): Promise<string> {
  return (await resourceBytes(path)).toString('utf8');
}
