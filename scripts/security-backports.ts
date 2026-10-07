import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, privateEncrypt, sign, constants } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// DESIGN-GAP: These advisories have no published fix; verify active pnpm backports
// with malformed inputs and valid controls before permitting their exact audit exceptions.
const require = createRequire(import.meta.url);
const paths = [resolve('node_modules/.pnpm/node_modules')];
type Ast = { type: string; nodes: Ast[]; value?: string };
type Braces = {
  parse: (pattern: string) => unknown;
  compile: (ast: unknown) => string;
  expand: (ast: unknown) => string[];
  stringify: (ast: unknown) => string;
};
/** Exercise the installed security backports, rather than a copy of their implementation. */
export async function verifySecurityBackports(): Promise<void> {
  const forgePath = require.resolve('node-forge', { paths });
  const forge = require(forgePath) as {
    pki: {
      publicKeyFromPem: (pem: string) => { verify: (digest: string, signature: string) => boolean };
    };
  };
  const rsa = await readFile(resolve(dirname(forgePath), 'rsa.js'), 'utf8');
  assert.match(rsa, /obj\.value\[0\]\.value\.length > 2/);
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const verifier = forge.pki.publicKeyFromPem(
    publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  );
  const message = Buffer.from('launch-backport-signature-control');
  const digest = createHash('sha256').update(message).digest();
  assert.ok(
    verifier.verify(
      digest.toString('binary'),
      sign('sha256', message, privateKey).toString('binary'),
    ),
  );
  const oid = Buffer.from('0609608648016503040201', 'hex');
  // Both canonical parameter forms remain accepted; neither extra children nor NULL payloads do.
  for (const [suffix, valid] of [
    ['', true],
    ['0500', true],
    ['0500040161', false],
    ['050161', false],
  ] as const) {
    const nested = Buffer.concat([oid, Buffer.from(suffix, 'hex')]);
    const algorithm = Buffer.concat([Buffer.from([0x30, nested.length]), nested]);
    const body = Buffer.concat([algorithm, Buffer.from([0x04, digest.length]), digest]);
    const encoded = Buffer.concat([Buffer.from([0x30, body.length]), body]);
    const signature = privateEncrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
      encoded,
    );
    const verify = () => verifier.verify(digest.toString('binary'), signature.toString('binary'));
    if (valid) assert.ok(verify());
    else assert.throws(verify, /DigestInfo/);
  }

  const bracesPath = require.resolve('braces', { paths });
  const braces = require(bracesPath) as Braces;
  assert.deepEqual(braces.expand(braces.parse('a{b,c}')), ['ab', 'ac']);
  for (const [open, close] of [
    ['{', '}'],
    ['(', ')'],
  ] as const)
    assert.throws(
      () => braces.parse(open.repeat(2000) + 'x' + close.repeat(2000)),
      /nesting exceeds/,
    );
  let ast: Ast = { type: 'text', value: 'x', nodes: [] };
  for (let depth = 0; depth < 2000; depth++) ast = { type: 'root', nodes: [ast] };
  for (const walker of [braces.compile, braces.expand, braces.stringify])
    assert.throws(() => walker(ast), /nesting exceeds/);

  const formatter = require(require.resolve('sprintf-js', { paths })) as {
    sprintf: (format: string, value: string | number) => string;
  };
  assert.equal(formatter.sprintf('%04d', 7), '0007');
  assert.equal(formatter.sprintf('%.2f', 1.234), '1.23');
  assert.equal(formatter.sprintf('%.3s', 'hello'), 'hel');
  for (const format of ['%1000000000s', '%.1000000000f', '%.101f', '%.1000000000s'])
    assert.throws(() => formatter.sprintf(format, 1), /safe formatting limit/);
}
