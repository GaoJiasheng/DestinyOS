import type { Locale } from '@tianji/shared';
import { z } from 'zod';
import { resourceText } from '../lib/platform/resources';
import { platform } from '../lib/platform/environment';
import { cloudflareBindings } from '../lib/platform/cloudflare';
import versions from './glossary-versions.json';

const catalogSchema = z.record(z.string());
const memory = new Map<Locale, Promise<Record<string, string>>>();

async function readGlossary(locale: Locale): Promise<Record<string, string>> {
  // DESIGN-GAP: Glossaries are public immutable Assets; content hashes isolate KV versions across deployments, with a one-hour TTL and an isolate-local cache.
  const key = `glossary:${versions[locale]}:${locale}`;
  const kv =
    platform() === 'cloudflare' && process.env.NEXT_PHASE !== 'phase-production-build'
      ? (await cloudflareBindings()).CACHE
      : undefined;
  if (kv) {
    try {
      const cached = await kv.get(key);
      if (cached !== null) return catalogSchema.parse(JSON.parse(cached));
    } catch {
      /* Assets remain authoritative when KV is unavailable or contains invalid data. */
    }
  }
  const text = await resourceText(`messages/${locale}/glossary.json`);
  const catalog = catalogSchema.parse(JSON.parse(text));
  if (kv) {
    try {
      await kv.put(key, text, { expirationTtl: 3600 });
    } catch {
      /* A cache write failure does not hide the public glossary. */
    }
  }
  return catalog;
}

/** Load only the requested locale, sharing concurrent reads and allowing retries after an Assets failure. */
export function loadGlossary(locale: Locale): Promise<Record<string, string>> {
  let pending = memory.get(locale);
  if (!pending) {
    pending = readGlossary(locale).catch((error: unknown) => {
      memory.delete(locale);
      throw error;
    });
    memory.set(locale, pending);
  }
  return pending;
}
