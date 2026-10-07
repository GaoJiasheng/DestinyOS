import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { BrowserWorker } from '@cloudflare/puppeteer';
import type {
  R2Bucket,
  Fetcher,
  D1Database,
  KVNamespace,
  SendEmail,
} from '@cloudflare/workers-types';
export interface PlatformBindings {
  MEDIA: { fetch(request: Request): Promise<Response> };
  EMAIL: SendEmail;
  DB: D1Database;
  CACHE: KVNamespace;
  RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
  EXPORT_BUCKET: R2Bucket;
  BROWSER: BrowserWorker;
  ASSETS: Fetcher;
}
/** Resolve request-scoped bindings; never store another request's binding context globally. */
export async function cloudflareBindings(): Promise<PlatformBindings> {
  return (await getCloudflareContext({ async: true })).env as unknown as PlatformBindings;
}
