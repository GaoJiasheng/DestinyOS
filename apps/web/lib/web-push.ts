/**
 * Web Push protocol on plain WebCrypto (runs in workerd, Node and browsers; no Node built-ins).
 * VAPID: RFC 8292 (ES256 JWT). Payload encryption: RFC 8291 over RFC 8188 aes128gcm.
 */
type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;
/** Push services reject larger bodies; one aes128gcm record keeps the payload well below 4096 bytes. */
export const MAX_PUSH_PLAINTEXT = 3000;

export function base64UrlEncode(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(value: string): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid base64url');
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function concat(...parts: Uint8Array[]): Bytes {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

/** Uncompressed P-256 point (0x04 || X || Y) plus the raw private scalar, both base64url. */
export type RawKeyPair = { publicKey: string; privateKey: string };

function publicPoint(encoded: string): Bytes {
  const point = base64UrlDecode(encoded);
  if (point.length !== 65 || point[0] !== 4) throw new Error('Invalid P-256 public key');
  return point;
}

function privateJwk(pair: RawKeyPair): JsonWebKey {
  const point = publicPoint(pair.publicKey);
  if (base64UrlDecode(pair.privateKey).length !== 32) throw new Error('Invalid P-256 private key');
  return {
    kty: 'EC',
    crv: 'P-256',
    d: pair.privateKey,
    x: base64UrlEncode(point.subarray(1, 33)),
    y: base64UrlEncode(point.subarray(33, 65)),
    ext: true,
  };
}

/** Generate a P-256 pair in the raw base64url form used by VAPID and by push subscriptions. */
export async function generateRawKeyPair(): Promise<RawKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  if (!jwk.d) throw new Error('Key export failed');
  return {
    publicKey: base64UrlEncode(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateKey: jwk.d,
  };
}

export type VapidInput = {
  endpoint: string;
  /** mailto: or https: contact, required by push services. */
  subject: string;
  keys: RawKeyPair;
  /** Seconds since epoch; injectable for tests. */
  now?: number;
  /** Token lifetime; RFC 8292 caps it at 24 hours. */
  ttlSeconds?: number;
};

/** Build the `Authorization: vapid t=..., k=...` header value for one push service origin. */
export async function vapidAuthorization(input: VapidInput): Promise<string> {
  if (!/^(mailto:|https:\/\/)/.test(input.subject)) throw new Error('Invalid VAPID subject');
  const ttl = Math.min(input.ttlSeconds ?? 12 * 3600, 24 * 3600);
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(
    encoder.encode(
      JSON.stringify({ aud: new URL(input.endpoint).origin, exp: now + ttl, sub: input.subject }),
    ),
  );
  const key = await crypto.subtle.importKey(
    'jwk',
    privateJwk(input.keys),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // WebCrypto ECDSA emits the raw r||s form that JWS ES256 requires.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(`${header}.${claims}`),
  );
  return `vapid t=${header}.${claims}.${base64UrlEncode(signature)}, k=${input.keys.publicKey}`;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8),
  );
}

async function sharedSecret(privateKey: RawKeyPair, peerPublic: Bytes): Promise<Bytes> {
  const own = await crypto.subtle.importKey(
    'jwk',
    privateJwk(privateKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const peer = await crypto.subtle.importKey(
    'raw',
    peerPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, own, 256));
}

async function contentKeys(
  secret: Bytes,
  authSecret: Bytes,
  userAgentPublic: Bytes,
  serverPublic: Bytes,
  salt: Bytes,
): Promise<{ key: CryptoKey; nonce: Bytes }> {
  const ikm = await hkdf(
    authSecret,
    secret,
    concat(encoder.encode('WebPush: info\0'), userAgentPublic, serverPublic),
    32,
  );
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);
  return {
    key: await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt', 'decrypt']),
    nonce,
  };
}

export type EncryptInput = {
  plaintext: string | Uint8Array;
  /** Subscription keys as delivered by PushSubscription.toJSON().keys. */
  p256dh: string;
  auth: string;
  /** Test hooks: production always uses a fresh salt and ephemeral key pair. */
  salt?: Uint8Array;
  localKeys?: RawKeyPair;
};

/** Encrypt one push message body (Content-Encoding: aes128gcm, single record). */
export async function encryptPushPayload(input: EncryptInput): Promise<Bytes> {
  const plaintext =
    typeof input.plaintext === 'string' ? encoder.encode(input.plaintext) : input.plaintext;
  if (plaintext.length > MAX_PUSH_PLAINTEXT) throw new Error('Push payload too large');
  const userAgentPublic = publicPoint(input.p256dh);
  const authSecret = base64UrlDecode(input.auth);
  if (authSecret.length !== 16) throw new Error('Invalid push auth secret');
  const salt = input.salt ? concat(input.salt) : crypto.getRandomValues(new Uint8Array(16));
  if (salt.length !== 16) throw new Error('Invalid salt');
  const local = input.localKeys ?? (await generateRawKeyPair());
  const serverPublic = publicPoint(local.publicKey);
  const { key, nonce } = await contentKeys(
    await sharedSecret(local, userAgentPublic),
    authSecret,
    userAgentPublic,
    serverPublic,
    salt,
  );
  // 0x02 marks the final (only) record; no extra padding.
  const body = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      key,
      concat(plaintext, new Uint8Array([2])),
    ),
  );
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = serverPublic.length;
  return concat(header, serverPublic, body);
}

/** Receiver side of RFC 8291; used by tests and the local mock push endpoint. */
export async function decryptPushPayload(
  body: Uint8Array,
  receiver: RawKeyPair,
  auth: string,
): Promise<Bytes> {
  const salt = concat(body.subarray(0, 16));
  if (body[20] !== 65) throw new Error('Invalid aes128gcm header');
  const serverPublic = concat(body.subarray(21, 86));
  const userAgentPublic = publicPoint(receiver.publicKey);
  const { key, nonce } = await contentKeys(
    await sharedSecret(receiver, serverPublic),
    base64UrlDecode(auth),
    userAgentPublic,
    serverPublic,
    salt,
  );
  const record = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      key,
      concat(body.subarray(86)),
    ),
  );
  let end = record.length - 1;
  while (end >= 0 && record[end] === 0) end -= 1;
  if (end < 0 || record[end] !== 2) throw new Error('Invalid aes128gcm padding');
  return concat(record.subarray(0, end));
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult =
  | { status: 'sent' }
  /** 404/410: the subscription no longer exists and must be deleted. */
  | { status: 'gone' }
  | { status: 'failed'; code: number };

export type SendOptions = {
  vapid: { subject: string; keys: RawKeyPair };
  /** Seconds the push service may hold an undelivered message; a daily reminder is stale after half a day. */
  ttl?: number;
  topic?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** Only public https push services are acceptable targets (no SSRF into local or plain-http hosts). */
export function validPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.hostname.includes('.') &&
      !/^[\d.]+$/.test(url.hostname) &&
      !url.hostname.startsWith('[') &&
      endpoint.length <= 2048
    );
  } catch {
    return false;
  }
}

/** Deliver one encrypted message; never throws for push-service responses or network errors. */
export async function sendPush(
  target: PushTarget,
  payload: string,
  options: SendOptions,
): Promise<PushResult> {
  try {
    const body = await encryptPushPayload({
      plaintext: payload,
      p256dh: target.p256dh,
      auth: target.auth,
    });
    const headers: Record<string, string> = {
      Authorization: await vapidAuthorization({ endpoint: target.endpoint, ...options.vapid }),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttl ?? 12 * 3600),
      Urgency: 'normal',
    };
    if (options.topic) headers.Topic = options.topic;
    const response = await (options.fetch ?? fetch)(target.endpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
    await response.arrayBuffer().catch(() => undefined);
    if (response.status === 404 || response.status === 410) return { status: 'gone' };
    return response.ok ? { status: 'sent' } : { status: 'failed', code: response.status };
  } catch {
    return { status: 'failed', code: 0 };
  }
}
