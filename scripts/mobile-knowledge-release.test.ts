import { it, expect } from 'vitest';
import { generateKeyPairSync, verify, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gunzipSync } from 'fflate';
import { z } from 'zod';
import {
  MobileKnowledgeEnvelopeSchema,
  MobileKnowledgeManifestSchema,
} from '../packages/content/src/mobile-wire';
import { DeltaSchema, KnowledgeSchema } from '../apps/mobile/lib/knowledge/schema';
const run = promisify(execFile);
it('builds signed M04-compatible full and incremental releases without persisting private keys', async () => {
  const output = await mkdtemp(join(tmpdir(), 'tianji-knowledge-')),
    key = generateKeyPairSync('ed25519');
  const env = {
    ...process.env,
    MOBILE_KNOWLEDGE_SIGNING_KEY: key.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString(),
  };
  try {
    await run(
      process.execPath,
      ['--import', 'tsx', 'scripts/mobile-knowledge-release.ts', '98.0.0', output],
      { env },
    );
    await run(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/mobile-knowledge-release.ts',
        '99.0.0',
        output,
        join(output, '98.0.0.baseline.json'),
      ],
      { env },
    );
    const envelope = MobileKnowledgeEnvelopeSchema.extend({
      payload: z.string().max(100000),
    }).parse(JSON.parse(await readFile(join(output, 'knowledge/manifest.json'), 'utf8')));
    expect(
      verify(
        null,
        Buffer.from(`tianji-knowledge-v1\n${envelope.payload}`),
        key.publicKey,
        Buffer.from(envelope.signature, 'hex'),
      ),
    ).toBe(true);
    const index = z
      .object({
        knowledgeVersion: z.literal('99.0.0'),
        bundles: z.array(
          z.object({ manifest: MobileKnowledgeEnvelopeSchema, bundleSignature: z.string() }),
        ),
      })
      .parse(JSON.parse(envelope.payload));
    const bundles = index.bundles.map((entry) => ({
      ...entry,
      descriptor: MobileKnowledgeManifestSchema.parse(JSON.parse(entry.manifest.payload)),
    }));
    const delta = bundles.find(
      (item) =>
        item.descriptor.knowledgeVersion === '99.0.0' &&
        item.descriptor.baseKnowledgeVersion === '98.0.0',
    )!;
    const full = bundles.find(
      (item) =>
        item.descriptor.knowledgeVersion === '99.0.0' &&
        item.descriptor.baseKnowledgeVersion === '0.0.0',
    )!;
    const bytes = await readFile(join(output, 'knowledge/99.0.0/98.0.0.json.gz'));
    expect(bytes.length).toBe(delta.descriptor.compressedSize);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(delta.descriptor.sha256);
    expect(verify(null, bytes, key.publicKey, Buffer.from(delta.bundleSignature, 'hex'))).toBe(
      true,
    );
    expect(
      verify(
        null,
        Buffer.from(`tianji-knowledge-v1\n${delta.manifest.payload}`),
        key.publicKey,
        Buffer.from(delta.manifest.signature, 'hex'),
      ),
    ).toBe(true);
    const content = DeltaSchema.parse(JSON.parse(new TextDecoder().decode(gunzipSync(bytes))));
    expect(content.upsert).toEqual([]);
    expect(content.remove).toEqual([]);
    const snapshot = DeltaSchema.parse(
      JSON.parse(
        new TextDecoder().decode(
          gunzipSync(await readFile(join(output, 'knowledge/99.0.0/0.0.0.json.gz'))),
        ),
      ),
    );
    expect(
      KnowledgeSchema.parse({
        knowledgeVersion: snapshot.knowledgeVersion,
        units: snapshot.upsert,
        glossary: snapshot.glossary,
        transitions: snapshot.transitions,
      }).units.length,
    ).toBeGreaterThan(100);
    expect(full.descriptor.compressedSize).toBeGreaterThan(delta.descriptor.compressedSize);
    expect(await readFile(join(output, 'knowledge/manifest.json'), 'utf8')).not.toContain(
      'PRIVATE KEY',
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
