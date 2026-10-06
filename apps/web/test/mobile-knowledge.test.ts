import { mf, request } from './mobile-fixture';
import { expect, it, vi } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { knowledgeManifest, knowledgeBundle } from '../lib/mobile/knowledge';
import { mobileApi } from '../lib/mobile/router';
import { issueSession } from '../lib/mobile/auth';
import { MobileKnowledgeManifestSchema } from '@tianji/content/mobile-wire';
it('serves M04-compatible signed manifests and full/delta R2 bytes, rejecting tampering', async () => {
  const pair = generateKeyPairSync('ed25519');
  vi.stubEnv('MOBILE_KNOWLEDGE_PUBLIC_KEY', pair.publicKey.export({ format: 'jwk' }).x!);
  vi.stubEnv('MOBILE_KNOWLEDGE_KEY_ID', 'v1');
  const bucket = await mf.getR2Bucket('EXPORT_BUCKET'),
    bytes = Buffer.from('compressed data');
  const signed = (payload: string) => ({
    keyId: 'v1',
    payload,
    signature: sign(null, Buffer.from(`tianji-knowledge-v1\n${payload}`), pair.privateKey).toString(
      'hex',
    ),
  });
  const bundles = ['0.0.0', '1.0.0'].map((baseKnowledgeVersion) => ({
    manifest: signed(
      JSON.stringify({
        knowledgeVersion: '2.0.0',
        baseKnowledgeVersion,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        compressedSize: bytes.length,
        decodedSize: 100,
      }),
    ),
    bundleSignature: sign(null, bytes, pair.privateKey).toString('hex'),
  }));
  const index = signed(JSON.stringify({ knowledgeVersion: '2.0.0', bundles }));
  await bucket.put('knowledge/manifest.json', JSON.stringify(index));
  await bucket.put('knowledge/2.0.0/0.0.0.json.gz', bytes);
  await bucket.put('knowledge/2.0.0/1.0.0.json.gz', bytes);
  expect(
    MobileKnowledgeManifestSchema.parse(JSON.parse((await knowledgeManifest()).payload))
      .baseKnowledgeVersion,
  ).toBe('0.0.0');
  expect(
    MobileKnowledgeManifestSchema.parse(JSON.parse((await knowledgeManifest('1.0.0')).payload))
      .baseKnowledgeVersion,
  ).toBe('1.0.0');
  expect(await (await knowledgeBundle('2.0.0', '1.0.0')).text()).toBe('compressed data');
  const token = (await issueSession('owner', { deviceName: 'phone', platform: 'ios' })).accessToken;
  const response = await mobileApi(
    request('knowledge/manifest?knowledgeVersion=1.0.0', 'GET', undefined, token),
  );
  expect(await response.json()).toEqual({ ok: true, data: bundles[1]!.manifest });
  await bucket.put('knowledge/2.0.0/0.0.0.json.gz', Buffer.from('tampered data!!'));
  await expect(knowledgeBundle('2.0.0', null)).rejects.toMatchObject({ status: 503 });
  await expect(knowledgeBundle('../v2', null)).rejects.toBeDefined();
  await bucket.put('knowledge/manifest.json', JSON.stringify({ ...index, payload: '{}' }));
  await expect(knowledgeManifest()).rejects.toMatchObject({ status: 503 });
});
