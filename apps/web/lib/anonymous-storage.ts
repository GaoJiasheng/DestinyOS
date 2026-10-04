import { z } from 'zod';
import { BirthInputSchema, System } from '@tianji/shared';
import {
  ReportSchema,
  ReadingMetaSchema,
  ReadingRequestSchema,
  type LocalReading,
} from './reading-schema';
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
  reportEn: ReportSchema.optional(),
  birthYear: z.number().optional(),
  displayName: z.string().optional(),
});
const dataSchema = z.object({
  anonId: z.string().uuid(),
  profile: BirthInputSchema.optional(),
  displayName: z.string().optional(),
  readings: z.array(localReading).max(50),
  settings: z.record(z.unknown()),
});
const envelope = z.object({
  version: z.literal(1),
  anonId: z.string().uuid(),
  iv: z.array(z.number().int().min(0).max(255)).length(12),
  ciphertext: z.array(z.number().int().min(0).max(255)),
});
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
    version: 1,
    anonId: valid.anonId,
    iv: [...iv],
    ciphertext: [...new Uint8Array(encrypted)],
  });
}
/** Authenticate before parsing stored data; malformed/tampered ciphertext is never silently replaced. */
export async function decryptAnonymous(raw: string): Promise<AnonymousData> {
  const value = envelope.parse(JSON.parse(raw));
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(value.iv),
      additionalData: new TextEncoder().encode(storageKey),
    },
    await key(value.anonId),
    new Uint8Array(value.ciphertext),
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
let queue: Promise<unknown> = Promise.resolve();
/** Serialize device mutations so concurrent language/import updates cannot lose readings. */
export function updateAnonymous(
  change: (data: AnonymousData) => AnonymousData,
): Promise<AnonymousData> {
  const next = queue.then(async () => {
    const data = (await readAnonymous()) ?? {
      anonId: crypto.randomUUID(),
      readings: [],
      settings: {},
    };
    const updated = dataSchema.parse(change(data));
    localStorage.setItem(storageKey, await encryptAnonymous(updated));
    document.cookie = 'anon_import=1; Path=/; SameSite=Lax';
    return updated;
  });
  queue = next.catch(() => undefined);
  return next;
}
/** Remove device data only after all imports have been acknowledged by the server. */
export function clearAnonymous() {
  localStorage.removeItem(storageKey);
  document.cookie = 'anon_import=; Max-Age=0; Path=/; SameSite=Lax';
}
