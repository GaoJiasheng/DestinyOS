import { randomBytes } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { gzipSync, strToU8 } from 'fflate';
import { bundledKnowledge } from '../lib/knowledge/bundled';
import { KnowledgeCache } from '../lib/knowledge/cache';
import { KnowledgeUpdater, createKnowledgeTransport } from '../lib/knowledge/update';
import { compareKnowledgeVersion } from '../lib/knowledge/schema';
import type { LocalDatabase } from '../lib/data/database';
import { testDatabase } from './sqlite';

let database: LocalDatabase;
// Ephemeral test signing material is generated per run and never persisted.
const seed = new Uint8Array(randomBytes(32));
const publicKey = ed25519.getPublicKey(seed);
const base = () => {
  const bundle = bundledKnowledge();
  return { ...bundle, units: bundle.units.slice(0, 3) };
};
beforeEach(async () => {
  database = await testDatabase();
});
afterEach(async () => {
  await database.close();
});
function updateFixture(overrides: Record<string, unknown> = {}) {
  const previous = base();
  const delta = {
    knowledgeVersion: '99.0.0',
    baseKnowledgeVersion: previous.knowledgeVersion,
    upsert: [
      { ...previous.units[0]!, zh: { ...previous.units[0]!.zh, title: '更新后的知识标题' } },
    ],
    remove: [previous.units[1]!.id],
  };
  const decoded = strToU8(JSON.stringify(delta));
  const compressed = gzipSync(decoded);
  const manifest = {
    knowledgeVersion: delta.knowledgeVersion,
    baseKnowledgeVersion: previous.knowledgeVersion,
    compressedSize: compressed.length,
    decodedSize: decoded.length,
    sha256: bytesToHex(sha256(compressed)),
    ...overrides,
  };
  function signed(payload = JSON.stringify(manifest)) {
    return {
      keyId: 'test',
      payload,
      signature: bytesToHex(ed25519.sign(strToU8(`tianji-knowledge-v1\n${payload}`), seed)),
    };
  }
  const transport = {
    manifest: jest.fn(async () => signed()),
    bundle: jest.fn(async () => compressed),
  };
  const cache = new KnowledgeCache(database, previous);
  const updater = new KnowledgeUpdater(cache, transport, { test: publicKey });
  return { previous, cache, updater, transport, signed, manifest, delta, compressed };
}
test('bundled knowledge contains all systems and both editorial languages without network', async () => {
  const bundle = bundledKnowledge();
  expect(new Set(bundle.units.map((unit) => unit.system))).toEqual(
    new Set([
      'common',
      'bazi',
      'ziwei',
      'iching',
      'qimen',
      'tarot',
      'astrology',
      'vedic',
      'numerology',
      'synastry',
      'daily',
    ]),
  );
  expect(bundle.units.every((unit) => unit.zh.body && unit.en.body)).toBe(true);
  expect(await new KnowledgeCache(database, bundle).load()).toEqual(bundle);
  expect(compareKnowledgeVersion('1.10.0', '1.9.9')).toBeGreaterThan(0);
});
test('signed gzip delta atomically upserts/removes and persists across new client instances', async () => {
  const { updater, cache, previous, transport } = updateFixture();
  expect(await updater.update()).toBe('updated');
  const next = await new KnowledgeCache(database, previous).load();
  expect(next.knowledgeVersion).toBe('99.0.0');
  expect(next.units).toHaveLength(2);
  expect(next.units.find((unit) => unit.id === previous.units[0]!.id)?.zh.title).toBe(
    '更新后的知识标题',
  );
  expect(await cache.load()).toEqual(next);
  expect(transport.bundle).toHaveBeenCalledTimes(1);
});
test.each([
  'signature',
  'key',
  'checksum',
  'truncated',
  'base',
  'rollback',
  'decodedSize',
  'schema',
])('%s failure preserves previous version and remains fully offline usable', async (kind) => {
  const f = updateFixture();
  if (kind === 'signature')
    f.transport.manifest.mockImplementation(async () => ({
      ...f.signed(),
      signature: '00'.repeat(64),
    }));
  if (kind === 'key')
    f.transport.manifest.mockImplementation(async () => ({ ...f.signed(), keyId: 'attacker' }));
  if (kind === 'checksum')
    f.transport.bundle.mockImplementation(async () =>
      f.compressed.map((byte, index) => (index === 2 ? byte ^ 1 : byte)),
    );
  if (kind === 'truncated')
    f.transport.bundle.mockImplementation(async () => f.compressed.subarray(0, 10));
  if (kind === 'base')
    f.transport.manifest.mockImplementation(async () =>
      f.signed(JSON.stringify({ ...f.manifest, baseKnowledgeVersion: '0.0.0' })),
    );
  if (kind === 'rollback')
    f.transport.manifest.mockImplementation(async () =>
      f.signed(JSON.stringify({ ...f.manifest, knowledgeVersion: '0.0.0' })),
    );
  if (kind === 'decodedSize')
    f.transport.manifest.mockImplementation(async () =>
      f.signed(JSON.stringify({ ...f.manifest, decodedSize: 1 })),
    );
  if (kind === 'schema') {
    const decoded = strToU8(
      JSON.stringify({ ...f.delta, upsert: [{ ...f.delta.upsert[0], en: null }] }),
    );
    const bytes = gzipSync(decoded);
    f.transport.manifest.mockImplementation(async () =>
      f.signed(
        JSON.stringify({
          ...f.manifest,
          compressedSize: bytes.length,
          decodedSize: decoded.length,
          sha256: bytesToHex(sha256(bytes)),
        }),
      ),
    );
    f.transport.bundle.mockImplementation(async () => bytes);
  }
  expect(await f.updater.update()).toBe('unavailable');
  expect(await f.cache.load()).toEqual(f.previous);
});
test('network failure, duplicate update calls and optimistic conflict are safe', async () => {
  const f = updateFixture();
  f.transport.manifest.mockRejectedValueOnce(new Error('offline'));
  expect(await f.updater.update()).toBe('unavailable');
  expect(await f.cache.load()).toEqual(f.previous);
  expect(await Promise.all([f.updater.update(), f.updater.update()])).toEqual([
    'updated',
    'updated',
  ]);
  expect(f.transport.bundle).toHaveBeenCalledTimes(1);
  await expect(
    f.cache.replace(f.previous.knowledgeVersion, { ...f.previous, knowledgeVersion: '99.1.0' }),
  ).rejects.toThrow('E_KNOWLEDGE_CONFLICT');
  expect((await f.cache.load()).knowledgeVersion).toBe('99.0.0');
});
test('bad cached JSON falls back to built-in package; a verified update can repair only public cache', async () => {
  const f = updateFixture();
  await database.write((sql) =>
    sql.runAsync('INSERT INTO KnowledgeCache VALUES(1,?,?)', '99.9.9', '{invalid'),
  );
  expect(await f.cache.load()).toEqual(f.previous);
  expect(await f.updater.update()).toBe('updated');
});
test('current manifest avoids bundle download', async () => {
  const f = updateFixture({ knowledgeVersion: base().knowledgeVersion });
  expect(await f.updater.update()).toBe('current');
  expect(f.transport.bundle).not.toHaveBeenCalled();
});
test('transport uses documented HTTPS mobile routes and sends only knowledgeVersion', async () => {
  const responses = [
    { ok: true, text: async () => '{}' },
    {
      ok: true,
      headers: { get: () => '2' },
      arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
    },
  ];
  const fetcher = jest.fn(async (input: RequestInfo | URL) => {
    void input;
    return responses.shift() as unknown as Response;
  });
  const transport = createKnowledgeTransport(fetcher);
  await transport.manifest('1.2.3');
  await transport.bundle('1.2.4', 2);
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    'https://tianji.gavin.pub/api/v1/mobile/knowledge/manifest?knowledgeVersion=1.2.3',
    'https://tianji.gavin.pub/api/v1/mobile/knowledge/bundle/1.2.4',
  ]);
});
