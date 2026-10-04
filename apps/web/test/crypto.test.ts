import { describe, expect, it } from 'vitest';
import { createCipheriv, hkdfSync } from 'node:crypto';
import { decryptField, encryptField } from '../lib/crypto';

const old = `v1:${Buffer.alloc(32, 1).toString('base64')}`;
const rotated = `v2:${Buffer.alloc(32, 2).toString('base64')},${old}`;
const aad = 'BirthProfile.encBirth';
describe('AES-256-GCM per-user encryption', () => {
  it.each(['', '中文 🔮', JSON.stringify({ year: 1990, month: 6, day: 15 }), 'x'.repeat(100_000)])(
    'round-trips UTF-8 including empty and large values',
    (plain) => {
      const cipher = encryptField(plain, aad, 'u1', old);
      expect(cipher).toMatch(/^v1:/);
      expect(decryptField(cipher, aad, 'u1', old)).toBe(plain);
      if (plain.length >= 4 && plain.length < 128) expect(cipher).not.toContain(plain);
    },
  );
  it('matches the documented HKDF SHA-256 context and GCM wire format', () => {
    const iv = Buffer.alloc(12, 7);
    const key = Buffer.from(hkdfSync('sha256', Buffer.alloc(32, 1), 'u1', 'field-v1', 32));
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad));
    const data = Buffer.concat([cipher.update('fixture'), cipher.final()]);
    const fixture = `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
    expect(decryptField(fixture, aad, 'u1', old)).toBe('fixture');
  });
  it('uses random 96-bit IVs, rejects wrong AAD and wrong owner', () => {
    const cipher = encryptField('private', aad, 'u1', old);
    expect(encryptField('private', aad, 'u1', old)).not.toBe(cipher);
    expect(Buffer.from(cipher.split(':')[1] ?? '', 'base64')).toHaveLength(12);
    expect(() => decryptField(cipher, 'BirthProfile.encPlace', 'u1', old)).toThrow();
    expect(() => decryptField(cipher, aad, 'u2', old)).toThrow();
  });
  it('reads old keys and writes the first configured key after rotation', () => {
    const cipher = encryptField('old', aad, 'u1', old);
    expect(decryptField(cipher, aad, 'u1', rotated)).toBe('old');
    const fresh = encryptField('new', aad, 'u1', rotated);
    expect(fresh.startsWith('v2:')).toBe(true);
    expect(decryptField(fresh, aad, 'u1', rotated)).toBe('new');
    expect(() => decryptField(fresh, aad, 'u1', old)).toThrow();
  });
  it('authenticates IV, tag, and data against tampering', () => {
    const cipher = encryptField('private', aad, 'u1', old);
    for (const index of [1, 2, 3]) {
      const parts = cipher.split(':');
      const bytes = Buffer.from(parts[index] ?? '', 'base64');
      bytes[0] = (bytes[0] ?? 0) ^ 1;
      parts[index] = bytes.toString('base64');
      expect(() => decryptField(parts.join(':'), aad, 'u1', old)).toThrow();
    }
  });
  it.each([
    '',
    'v1:bad',
    `v1:${Buffer.alloc(31).toString('base64')}`,
    `${old},${old}`,
    old.replace('v1', 'v0'),
  ])('rejects malformed key configuration', (config) => {
    expect(() => encryptField('private', aad, 'u1', config)).toThrow();
  });
  it.each(['garbage', 'v9:AAAA:AAAA:AAAA', 'v1:bad:bad:bad', 'v1::::'])(
    'rejects malformed ciphertext',
    (cipher) => {
      expect(() => decryptField(cipher, aad, 'u1', old)).toThrow();
    },
  );
  it('requires owner and table.column context', () => {
    expect(() => encryptField('private', aad, '', old)).toThrow();
    expect(() => encryptField('private', 'encBirth', 'u1', old)).toThrow();
  });
});
