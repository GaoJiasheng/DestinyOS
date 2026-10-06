import {
  MobileKnowledgeEnvelopeSchema as EnvelopeSchema,
  MobileKnowledgeManifestSchema as ManifestSchema,
} from '@tianji/content/mobile-wire';
import { apiSuccessSchema } from '@tianji/shared';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { Gunzip, strFromU8, strToU8 } from 'fflate';
import { brand } from '@tianji/shared/brand';
import { DeltaSchema, KnowledgeSchema, compareKnowledgeVersion } from './schema';
import type { KnowledgeCache } from './cache';

const maxDecoded = 32 * 1024 * 1024;
export interface KnowledgeTransport {
  manifest(knowledgeVersion: string): Promise<unknown>;
  bundle(knowledgeVersion: string, expectedBytes: number): Promise<Uint8Array>;
}
export type KnowledgeUpdateResult = 'current' | 'updated' | 'unavailable';
/** M09 transport sends only the installed knowledge version plus an optional SecureStore Bearer credential. */
export function createKnowledgeTransport(
  fetcher: typeof fetch = fetch,
  accessToken?: () => Promise<string | undefined>,
): KnowledgeTransport {
  const base = `https://${brand.domain}/api/v1/mobile/knowledge`;
  let baseVersion: string | undefined;
  async function response(path: string) {
    const token = await accessToken?.();
    // DESIGN-GAP: Knowledge update requests use a 15-second timeout and never follow redirects.
    const result = await fetcher(`${base}/${path}`, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
    if (!result.ok) throw new Error('E_KNOWLEDGE_NETWORK');
    return result;
  }
  return {
    async manifest(version) {
      baseVersion = version;
      const result = await response(`manifest?knowledgeVersion=${encodeURIComponent(version)}`);
      const text = await result.text();
      if (text.length > 20_000) throw new Error('E_KNOWLEDGE_SIZE');
      return apiSuccessSchema(EnvelopeSchema).parse(JSON.parse(text)).data;
    },
    async bundle(version, expectedBytes) {
      const result = await response(
        `bundle/${encodeURIComponent(version)}${baseVersion ? `?since=${encodeURIComponent(baseVersion)}` : ''}`,
      );
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
  /** Call on connectivity restoration or foreground; unavailable authentication leaves the bundled offline release usable. */
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
      (manifest.baseKnowledgeVersion !== '0.0.0' &&
        manifest.baseKnowledgeVersion !== current.knowledgeVersion) ||
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
    const full = manifest.baseKnowledgeVersion === '0.0.0';
    if (full && (!delta.glossary || !delta.transitions)) throw new Error('E_KNOWLEDGE_VERSION');
    const units = new Map((full ? [] : current.units).map((unit) => [unit.id, unit]));
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
