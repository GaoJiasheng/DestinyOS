import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

type Key = { version: string; master: Buffer };

function base64(value: string, size?: number): Buffer {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || (size !== undefined && bytes.length !== size)) {
    throw new Error('Invalid field encryption encoding');
  }
  return bytes;
}

function keys(config = process.env.FIELD_ENCRYPTION_KEYS): Key[] {
  if (!config) throw new Error('FIELD_ENCRYPTION_KEYS is required');
  const seen = new Set<string>();
  return config.split(',').map((entry) => {
    const [version, encoded, extra] = entry.trim().split(':');
    if (!version || !/^v[1-9]\d*$/.test(version) || !encoded || extra || seen.has(version)) {
      throw new Error('Invalid field encryption key configuration');
    }
    seen.add(version);
    return { version, master: base64(encoded, 32) };
  });
}

function subKey(master: Buffer, userId: string): Buffer {
  if (!userId) throw new Error('Field encryption requires a userId');
  return Buffer.from(hkdfSync('sha256', master, userId, 'field-v1', 32));
}

/** Encrypt UTF-8 plaintext with table.column AAD and a per-user HKDF key; first configured version writes. */
export function encryptField(plain: string, aad: string, userId: string, config?: string): string {
  const key = keys(config)[0];
  if (
    !key ||
    !(
      /^[A-Za-z]+\.enc[A-Za-z]+$/.test(aad) ||
      aad === 'ChatMessage.content' ||
      aad === 'BirthProfile.label'
    )
  )
    throw new Error('Invalid encryption context');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', subKey(key.master, userId), iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    key.version,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':');
}

/** Authenticate and decrypt a versioned ciphertext with its original table.column and owner. */
export function decryptField(value: string, aad: string, userId: string, config?: string): string {
  const parts = value.split(':');
  const [version, encodedIv, encodedTag, encodedData] = parts;
  if (
    parts.length !== 4 ||
    encodedIv === undefined ||
    encodedTag === undefined ||
    encodedData === undefined
  ) {
    throw new Error('Invalid field ciphertext');
  }
  const key = keys(config).find((entry) => entry.version === version);
  if (!key) throw new Error('Unknown field encryption key version');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    subKey(key.master, userId),
    base64(encodedIv, 12),
  );
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(base64(encodedTag, 16));
  return Buffer.concat([decipher.update(base64(encodedData)), decipher.final()]).toString('utf8');
}
