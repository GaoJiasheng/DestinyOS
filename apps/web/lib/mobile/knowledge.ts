import { z } from 'zod';
import { createHash } from 'node:crypto';
import {
  MobileKnowledgeEnvelopeSchema,
  MobileKnowledgeManifestSchema,
  KnowledgeVersionSchema,
} from '@tianji/content/mobile-wire';
import { cloudflareBindings } from '../platform/cloudflare';
import { ApiError } from '../api-error';
const signature = z.string().regex(/^[a-f0-9]{128}$/);
const indexEnvelope = MobileKnowledgeEnvelopeSchema.extend({ payload: z.string().max(100000) });
const indexSchema = z
  .object({
    knowledgeVersion: KnowledgeVersionSchema,
    bundles: z
      .array(
        z.object({ manifest: MobileKnowledgeEnvelopeSchema, bundleSignature: signature }).strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
/** Verify detached Ed25519 signatures using the pinned raw public key, never a downloaded key. */
export async function verifyKnowledge(bytes: Uint8Array, signatureValue: string): Promise<boolean> {
  const configured = process.env.MOBILE_KNOWLEDGE_PUBLIC_KEY;
  if (!configured) throw new ApiError('E_INTERNAL', 'Knowledge verification key missing', 503);
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      Buffer.from(configured, 'base64url'),
      'Ed25519',
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      Buffer.from(signatureValue, 'hex'),
      new Uint8Array(bytes),
    );
  } catch {
    return false;
  }
}
async function verifiedManifest(raw: unknown, index = false) {
  const envelope = (index ? indexEnvelope : MobileKnowledgeEnvelopeSchema).parse(raw);
  if (
    envelope.keyId !== (process.env.MOBILE_KNOWLEDGE_KEY_ID || 'v1') ||
    !(await verifyKnowledge(
      Buffer.from(`tianji-knowledge-v1\n${envelope.payload}`),
      envelope.signature,
    ))
  )
    throw new ApiError('E_INTERNAL', 'Invalid knowledge signature', 503);
  return envelope;
}
async function select(version: string | null, since: string | null) {
  const base = since === null ? null : KnowledgeVersionSchema.parse(since);
  // DESIGN-GAP: Reuse EXPORT_BUCKET under knowledge/; signed catalog descriptors point to immutable gzip JSON upsert/remove packages.
  const object = await (await cloudflareBindings()).EXPORT_BUCKET.get('knowledge/manifest.json');
  if (!object || object.size > 150000)
    throw new ApiError('E_NOT_FOUND', 'Knowledge manifest unavailable', 404);
  const envelope = await verifiedManifest(await object.json(), true),
    index = indexSchema.parse(JSON.parse(envelope.payload));
  const target = version === null ? index.knowledgeVersion : KnowledgeVersionSchema.parse(version);
  const candidates = index.bundles
    .map((entry) => ({
      ...entry,
      descriptor: MobileKnowledgeManifestSchema.parse(JSON.parse(entry.manifest.payload)),
    }))
    .filter((entry) => entry.descriptor.knowledgeVersion === target);
  const entry =
    candidates.find((item) => item.descriptor.baseKnowledgeVersion === base) ??
    candidates.find((item) => item.descriptor.baseKnowledgeVersion === '0.0.0');
  if (!entry) throw new ApiError('E_NOT_FOUND', 'Knowledge bundle unavailable', 404);
  await verifiedManifest(entry.manifest);
  return entry;
}
/** Return the exact shared M04 manifest envelope for the installed version; 0.0.0 denotes a full snapshot fallback. */
export async function knowledgeManifest(since: string | null = null) {
  return (await select(null, since)).manifest;
}
/** Verify signed compressed bytes, SHA-256 and size before serving the full or incremental R2 package. */
export async function knowledgeBundle(version: string, since: string | null) {
  const { descriptor, bundleSignature } = await select(version, since);
  const key = `knowledge/${descriptor.knowledgeVersion}/${descriptor.baseKnowledgeVersion}.json.gz`;
  const object = await (await cloudflareBindings()).EXPORT_BUCKET.get(key);
  if (!object || object.size !== descriptor.compressedSize)
    throw new ApiError('E_INTERNAL', 'Invalid knowledge bundle size', 503);
  const data = new Uint8Array(await object.arrayBuffer());
  if (
    createHash('sha256').update(data).digest('hex') !== descriptor.sha256 ||
    !(await verifyKnowledge(data, bundleSignature))
  )
    throw new ApiError('E_INTERNAL', 'Invalid knowledge bundle signature', 503);
  return new Response(data, {
    headers: {
      'Content-Type': 'application/gzip',
      'Cache-Control': 'private, no-store',
      'X-Knowledge-Version': descriptor.knowledgeVersion,
      'X-Knowledge-Signature': bundleSignature,
      'X-Knowledge-SHA256': descriptor.sha256,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
