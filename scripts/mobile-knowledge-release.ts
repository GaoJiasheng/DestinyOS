import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPrivateKey, createPublicKey, sign, verify, createHash } from 'node:crypto';
import { gzipSync } from 'fflate';
import { z } from 'zod';
import {
  KnowledgeVersionSchema,
  MobileKnowledgeEnvelopeSchema,
  MobileKnowledgeManifestSchema,
  compareKnowledgeVersion,
} from '../packages/content/src/mobile-wire';
const record = z.object({ id: z.string() }).passthrough();
const baselineSchema = z.object({
  knowledgeVersion: KnowledgeVersionSchema,
  units: z.array(record),
  glossary: z.array(z.unknown()),
  transitions: z.record(z.unknown()),
});
/** Build shared M04/M09 upsert/remove packages with a full snapshot fallback; private keys exist only in the release process. */
async function main() {
  const version = KnowledgeVersionSchema.parse(process.argv[2]),
    output = resolve(process.argv[3] ?? '.test-data/mobile-knowledge');
  if (!process.env.MOBILE_KNOWLEDGE_SIGNING_KEY)
    throw new Error('MOBILE_KNOWLEDGE_SIGNING_KEY (Ed25519 PEM) required');
  const key = createPrivateKey(process.env.MOBILE_KNOWLEDGE_SIGNING_KEY),
    publicKey = createPublicKey(key),
    keyId = process.env.MOBILE_KNOWLEDGE_KEY_ID || 'v1';
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Ed25519 key required');
  const units = new Map<string, z.infer<typeof record>>(),
    glossary = new Map<string, unknown>();
  let transitions: Record<string, unknown> | undefined;
  for (const file of (await readdir('packages/content/dist'))
    .filter((name) => name.endsWith('.zh.json'))
    .sort()) {
    const compiled = z
      .object({
        units: z.array(record),
        glossary: z.array(z.object({ key: z.string() }).passthrough()),
        transitions: z.record(z.unknown()),
      })
      .parse(JSON.parse(await readFile(`packages/content/dist/${file}`, 'utf8')));
    for (const unit of compiled.units) units.set(unit.id, unit);
    for (const entry of compiled.glossary) glossary.set(entry.key, entry);
    transitions ??= compiled.transitions;
  }
  if (!transitions) throw new Error('Compiled knowledge required');
  const current = {
    knowledgeVersion: version,
    units: [...units.values()].sort((a, b) => a.id.localeCompare(b.id)),
    glossary: [...glossary.values()],
    transitions,
  };
  const baseline = process.argv[4]
    ? baselineSchema.parse(JSON.parse(await readFile(process.argv[4], 'utf8')))
    : null;
  if (baseline && compareKnowledgeVersion(version, baseline.knowledgeVersion) <= 0)
    throw new Error('Release must advance knowledgeVersion');
  const old = new Map(baseline?.units.map((unit) => [unit.id, unit]) ?? []);
  const variants = [
    { baseKnowledgeVersion: '0.0.0', upsert: current.units, remove: [] as string[] },
    ...(baseline
      ? [
          {
            baseKnowledgeVersion: baseline.knowledgeVersion,
            upsert: current.units.filter(
              (unit) => JSON.stringify(unit) !== JSON.stringify(old.get(unit.id)),
            ),
            remove: [...old.keys()].filter((id) => !units.has(id)),
          },
        ]
      : []),
  ];
  const signed = (payload: string) => ({
    keyId,
    payload,
    signature: sign(null, Buffer.from(`tianji-knowledge-v1\n${payload}`), key).toString('hex'),
  });
  const catalog: {
    manifest: z.infer<typeof MobileKnowledgeEnvelopeSchema>;
    bundleSignature: string;
  }[] = [];
  await mkdir(resolve(output, `knowledge/${version}`), { recursive: true });
  for (const variant of variants) {
    // DESIGN-GAP: Full snapshots use base 0.0.0; deltas upsert/remove bilingual units and replace glossary/transitions atomically.
    const decoded = Buffer.from(
        JSON.stringify({
          knowledgeVersion: version,
          ...variant,
          glossary: current.glossary,
          transitions,
        }),
      ),
      bytes = gzipSync(decoded, { level: 9 });
    const descriptor = MobileKnowledgeManifestSchema.parse({
      knowledgeVersion: version,
      baseKnowledgeVersion: variant.baseKnowledgeVersion,
      compressedSize: bytes.length,
      decodedSize: decoded.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    await immutableBundle(
      resolve(output, `knowledge/${version}/${variant.baseKnowledgeVersion}.json.gz`),
      bytes,
    );
    catalog.push({
      manifest: MobileKnowledgeEnvelopeSchema.parse(signed(JSON.stringify(descriptor))),
      bundleSignature: sign(null, bytes, key).toString('hex'),
    });
  }
  let previous: typeof catalog = [];
  try {
    const envelope = MobileKnowledgeEnvelopeSchema.extend({
      payload: z.string().max(100000),
    }).parse(JSON.parse(await readFile(resolve(output, 'knowledge/manifest.json'), 'utf8')));
    if (
      envelope.keyId !== keyId ||
      !verify(
        null,
        Buffer.from(`tianji-knowledge-v1\n${envelope.payload}`),
        publicKey,
        Buffer.from(envelope.signature, 'hex'),
      )
    )
      throw new Error('Existing catalog signature invalid');
    previous = z
      .object({
        bundles: z.array(
          z.object({ manifest: MobileKnowledgeEnvelopeSchema, bundleSignature: z.string() }),
        ),
      })
      .parse(JSON.parse(envelope.payload))
      .bundles.filter(
        (entry) =>
          MobileKnowledgeManifestSchema.parse(JSON.parse(entry.manifest.payload))
            .knowledgeVersion !== version,
      );
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }
  const index = signed(
    JSON.stringify({ knowledgeVersion: version, bundles: [...previous, ...catalog].slice(-100) }),
  );
  if (index.payload.length > 100000) throw new Error('Catalog size budget exceeded');
  await writeFile(resolve(output, 'knowledge/manifest.json'), JSON.stringify(index));
  await writeFile(resolve(output, `${version}.baseline.json`), JSON.stringify(current));
  process.stdout.write(
    `Signed release ${version}; keyId=${keyId}; MOBILE_KNOWLEDGE_PUBLIC_KEY=${publicKey.export({ format: 'jwk' }).x}\n`,
  );
}
async function immutableBundle(path: string, bytes: Uint8Array) {
  try {
    const existing = await readFile(path);
    if (!existing.equals(Buffer.from(bytes)))
      throw new Error('Knowledge version already contains different data');
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }
  await writeFile(path, bytes);
}
await main();
