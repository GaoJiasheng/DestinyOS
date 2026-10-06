import { z } from 'zod';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { Gunzip, strFromU8, strToU8 } from 'fflate';
import { brand } from '@tianji/shared/brand';
import {
  DeltaSchema,
  KnowledgeSchema,
  KnowledgeVersionSchema,
  compareKnowledgeVersion,
} from './schema';
import type { KnowledgeCache } from './cache';

const maxCompressed = 8 * 1024 * 1024,
  maxDecoded = 32 * 1024 * 1024;
const EnvelopeSchema = z
  .object({
    payload: z.string().max(16_384),
    signature: z.string().regex(/^[a-f0-9]{128}$/),
    keyId: z.string().min(1).max(100),
  })
  .strict();
const ManifestSchema = z
  .object({
    knowledgeVersion: KnowledgeVersionSchema,
    baseKnowledgeVersion: KnowledgeVersionSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    compressedSize: z.number().int().positive().max(maxCompressed),
    decodedSize: z.number().int().positive().max(maxDecoded),
  })
  .strict();
export interface KnowledgeTransport {
  manifest(knowledgeVersion: string): Promise<unknown>;
  bundle(knowledgeVersion: string, expectedBytes: number): Promise<Uint8Array>;
}
export type KnowledgeUpdateResult = 'current' | 'updated' | 'unavailable';
/** M09 public transport sends only knowledgeVersion, with no birth/profile/account/token fields. */
export function createKnowledgeTransport(fetcher: typeof fetch = fetch): KnowledgeTransport {
  const base = `https://${brand.domain}/api/v1/mobile/knowledge`;
  async function response(path: string) {
    // DESIGN-GAP: Public update requests use a 15-second timeout and never follow redirects.
    const result = await fetcher(`${base}/${path}`, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    if (!result.ok) throw new Error('E_KNOWLEDGE_NETWORK');
    return result;
  }
  return {
    async manifest(version) {
      const result = await response(`manifest?knowledgeVersion=${encodeURIComponent(version)}`);
      const text = await result.text();
      if (text.length > 20_000) throw new Error('E_KNOWLEDGE_SIZE');
      return JSON.parse(text) as unknown;
    },
    async bundle(version, expectedBytes) {
      const result = await response(`bundle/${encodeURIComponent(version)}`);
      const length = result.headers.get('content-length');
      if (length !== null && Number(length) !== expectedBytes) throw new Error('E_KNOWLEDGE_SIZE');
      const bytes = new Uint8Array(await result.arrayBuffer());
      if (bytes.length !== expectedBytes) throw new Error('E_KNOWLEDGE_SIZE');
      return bytes;
    },
  };
}
/** Single-flight, signed delta update. Failure always leaves the previous offline release usable. */
export class KnowledgeUpdater {
  private pending: Promise<KnowledgeUpdateResult> | undefined;
  constructor(
    private readonly cache: KnowledgeCache,
    private readonly transport: KnowledgeTransport,
    // DESIGN-GAP: Ed25519 trust anchors ship in the client, never in the downloaded manifest.
    // M09 must provision the production public key; an empty map deliberately fails closed.
    private readonly trustedKeys: Readonly<Record<string, Uint8Array>>,
  ) {}
  /** Call on connectivity restoration or foreground; anonymous operation needs no login. */
  update(): Promise<KnowledgeUpdateResult> {
    this.pending ??= this.perform()
      .catch(() => 'unavailable' as const)
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }
  private async perform(): Promise<KnowledgeUpdateResult> {
    const current = await this.cache.load();
    const envelope = EnvelopeSchema.parse(await this.transport.manifest(current.knowledgeVersion));
    const key = this.trustedKeys[envelope.keyId];
    if (
      !key ||
      key.length !== 32 ||
      !ed25519.verify(
        hexToBytes(envelope.signature),
        strToU8(`tianji-knowledge-v1\n${envelope.payload}`),
        key,
        { zip215: false },
      )
    )
      throw new Error('E_KNOWLEDGE_SIGNATURE');
    const manifest = ManifestSchema.parse(JSON.parse(envelope.payload));
    if (compareKnowledgeVersion(manifest.knowledgeVersion, current.knowledgeVersion) === 0)
      return 'current';
    if (
      manifest.baseKnowledgeVersion !== current.knowledgeVersion ||
      compareKnowledgeVersion(manifest.knowledgeVersion, current.knowledgeVersion) < 0
    )
      throw new Error('E_KNOWLEDGE_VERSION');
    const compressed = await this.transport.bundle(
      manifest.knowledgeVersion,
      manifest.compressedSize,
    );
    if (
      compressed.length !== manifest.compressedSize ||
      bytesToHex(sha256(compressed)) !== manifest.sha256
    )
      throw new Error('E_KNOWLEDGE_CHECKSUM');
    const delta = DeltaSchema.parse(JSON.parse(decodeGzip(compressed, manifest.decodedSize)));
    if (
      delta.knowledgeVersion !== manifest.knowledgeVersion ||
      delta.baseKnowledgeVersion !== manifest.baseKnowledgeVersion
    )
      throw new Error('E_KNOWLEDGE_VERSION');
    if (
      new Set(delta.upsert.map((unit) => unit.id)).size !== delta.upsert.length ||
      new Set(delta.remove).size !== delta.remove.length ||
      delta.upsert.some((unit) => delta.remove.includes(unit.id))
    )
      throw new Error('E_KNOWLEDGE_DUPLICATE');
    const units = new Map(current.units.map((unit) => [unit.id, unit]));
    for (const id of delta.remove) units.delete(id);
    for (const unit of delta.upsert) units.set(unit.id, unit);
    const next = KnowledgeSchema.parse({
      knowledgeVersion: manifest.knowledgeVersion,
      units: [...units.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      glossary: delta.glossary ?? current.glossary,
      transitions: delta.transitions ?? current.transitions,
    });
    await this.cache.replace(current.knowledgeVersion, next);
    return 'updated';
  }
}
function decodeGzip(compressed: Uint8Array, expected: number): string {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const decoder = new Gunzip((chunk) => {
    size += chunk.length;
    if (size > expected || size > maxDecoded) throw new Error('E_KNOWLEDGE_SIZE');
    chunks.push(chunk);
  });
  for (let offset = 0; offset < compressed.length; offset += 4096)
    decoder.push(compressed.subarray(offset, offset + 4096), offset + 4096 >= compressed.length);
  if (size !== expected) throw new Error('E_KNOWLEDGE_SIZE');
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return strFromU8(output);
}
