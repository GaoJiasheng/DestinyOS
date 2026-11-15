import { z } from 'zod';
import { BirthInputSchema, System } from '@tianji/shared';
import {
  ReportSchema,
  ReadingMetaSchema,
  ReadingRequestSchema,
  type LocalReading,
} from './reading-schema';
import {
  anonymousEvictionEvent,
  fromBase64,
  isQuotaError,
  toBase64,
  type AnonymousEviction,
} from './anonymous-encoding';
export { anonymousEvictionEvent, type AnonymousEviction };
export type AnonymousData = {
  anonId: string;
  profile?: z.infer<typeof BirthInputSchema>;
  displayName?: string;
  readings: LocalReading[];
  settings: Record<string, unknown>;
};
const localReading = z.object({
  id: z.string().uuid(),
  system: z.nativeEnum(System),
  createdAt: z.string().datetime(),
  title: z.string().nullable(),
  chart: z.record(z.unknown()),
  report: ReportSchema,
  meta: ReadingMetaSchema,
  request: ReadingRequestSchema,
  reportZh: ReportSchema.optional(),
  reportZhTw: ReportSchema.optional(),
  reportEn: ReportSchema.optional(),
  birthYear: z.number().optional(),
  displayName: z.string().optional(),
});
/** Device snapshot schema, shared with the settings import so exported files are checked identically. */
export const anonymousDataSchema = z.object({
  anonId: z.string().uuid(),
  profile: BirthInputSchema.optional(),
  displayName: z.string().optional(),
  readings: z.array(localReading).max(50),
  settings: z.record(z.unknown()),
});
const dataSchema = anonymousDataSchema;
const byte = z.number().int().min(0).max(255);
const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
// Version 1 stored bytes as JSON number arrays (about 3.7 characters per byte); version 2 stores base64 (1.33).
const envelope = z.discriminatedUnion('version', [
  z.object({
    version: z.literal(1),
    anonId: z.string().uuid(),
    iv: z.array(byte).length(12),
    ciphertext: z.array(byte),
  }),
  z.object({
    version: z.literal(2),
    anonId: z.string().uuid(),
    iv: base64.length(16),
    ciphertext: base64,
  }),
]);
const storageKey = 'tianji.anon';
async function key(anonId: string) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(anonId),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('tianji.anon.v1'),
      info: new TextEncoder().encode(storageKey),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
/** Encrypt the complete device snapshot using a fresh 96-bit nonce and anonId-derived AES-GCM key. */
export async function encryptAnonymous(data: AnonymousData): Promise<string> {
  const valid = dataSchema.parse(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(storageKey) },
    await key(valid.anonId),
    new TextEncoder().encode(JSON.stringify(valid)),
  );
  return JSON.stringify({
    version: 2,
    anonId: valid.anonId,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  });
}
/** Authenticate before parsing stored data; malformed/tampered ciphertext is never silently replaced. */
export async function decryptAnonymous(raw: string): Promise<AnonymousData> {
  const value = envelope.parse(JSON.parse(raw));
  const iv = value.version === 1 ? new Uint8Array(value.iv) : fromBase64(value.iv),
    ciphertext =
      value.version === 1 ? new Uint8Array(value.ciphertext) : fromBase64(value.ciphertext);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(storageKey) },
    await key(value.anonId),
    ciphertext,
  );
  const data = dataSchema.parse(JSON.parse(new TextDecoder().decode(plain)));
  if (data.anonId !== value.anonId) throw new Error('Anonymous identity mismatch');
  return data;
}
/** Read decrypted local data; an absent device snapshot returns null. */
export async function readAnonymous(): Promise<AnonymousData | null> {
  const raw = localStorage.getItem(storageKey);
  return raw ? decryptAnonymous(raw) : null;
}
/**
 * Write the snapshot, dropping the oldest readings one at a time while the browser reports a full quota.
 * Readings added by this update and the newest remaining reading are never dropped.
 */
async function persist(
  data: AnonymousData,
  protectedIds: Set<string>,
): Promise<{ data: AnonymousData; evicted: number }> {
  let current = data,
    evicted = 0;
  for (;;) {
    try {
      localStorage.setItem(storageKey, await encryptAnonymous(current));
      return { data: current, evicted };
    } catch (error) {
      if (!isQuotaError(error) || current.readings.length <= 1) throw error;
      const oldest = current.readings
        .filter((reading) => !protectedIds.has(reading.id))
        .reduce<LocalReading | null>(
          (min, reading) => (!min || reading.createdAt < min.createdAt ? reading : min),
          null,
        );
      if (!oldest) throw error;
      current = { ...current, readings: current.readings.filter((r) => r !== oldest) };
      evicted++;
    }
  }
}
let queue: Promise<unknown> = Promise.resolve();
/**
 * Serialize device mutations so concurrent language/import updates cannot lose readings.
 * Every write uses the current envelope version, so older snapshots upgrade on their next change.
 */
export function updateAnonymous(
  change: (data: AnonymousData) => AnonymousData,
  options?: { onEvict?: (eviction: AnonymousEviction) => void },
): Promise<AnonymousData> {
  const next = queue.then(async () => {
    const data = (await readAnonymous()) ?? {
      anonId: crypto.randomUUID(),
      readings: [],
      settings: {},
    };
    const before = new Set(data.readings.map((reading) => reading.id));
    const updated = dataSchema.parse(change(data));
    const added = new Set(updated.readings.map((r) => r.id).filter((id) => !before.has(id)));
    const result = await persist(updated, added);
    document.cookie = 'anon_import=1; Path=/; SameSite=Lax';
    if (result.evicted) {
      const eviction = { count: result.evicted };
      options?.onEvict?.(eviction);
      window.dispatchEvent(new CustomEvent(anonymousEvictionEvent, { detail: eviction }));
    }
    return result.data;
  });
  queue = next.catch(() => undefined);
  return next;
}
/** Remove device data only after all imports have been acknowledged by the server. */
export function clearAnonymous() {
  localStorage.removeItem(storageKey);
  document.cookie = 'anon_import=; Max-Age=0; Path=/; SameSite=Lax';
}
