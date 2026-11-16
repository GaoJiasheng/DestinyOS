import { cacheDelete, cacheRead, cacheWrite } from './cache';
import { assertRateLimit, ratelimit } from './ratelimit';

/**
 * Six-digit email sign-in codes bound to one Auth.js magic-link token and to the browser that asked
 * for it. Only WebCrypto is used so the module runs unchanged on Cloudflare Workers.
 */
export const loginCodeTtlSeconds = 15 * 60;
export const maxLoginCodeAttempts = 5;
/** httpOnly cookie holding the random value that ties a code to the requesting browser. */
export const loginDeviceCookie = 'tianji-login-device';

type StoredCode = {
  v: 1;
  id: string;
  mac: string;
  device: string;
  iv: string;
  token: string;
  exp: number;
};
export type RedeemResult =
  { ok: true; token: string } | { ok: false; attemptsLeft?: number; exhausted?: boolean };

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<{ mac: CryptoKey; enc: CryptoKey }>>();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Derive separate MAC and encryption keys from AUTH_SECRET with HKDF; nothing else is stored. */
function keys(): Promise<{ mac: CryptoKey; enc: CryptoKey }> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required for sign-in codes');
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const derived = (async () => {
    const base = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
      'deriveKey',
    ]);
    const params = (info: string) => ({
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('tianji-login-code-v1'),
      info: encoder.encode(info),
    });
    const [mac, enc] = await Promise.all([
      crypto.subtle.deriveKey(
        params('mac'),
        base,
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        false,
        ['sign'],
      ),
      crypto.subtle.deriveKey(params('enc'), base, { name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ]),
    ]);
    return { mac, enc };
  })();
  keyCache.set(secret, derived);
  return derived;
}

async function hmac(message: string): Promise<string> {
  const { mac } = await keys();
  return toBase64Url(
    new Uint8Array(await crypto.subtle.sign('HMAC', mac, encoder.encode(message))),
  );
}

/** Compare two strings without an early exit, so timing does not reveal how many characters match. */
export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index++)
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}

/** Uniform 000000–999999 by rejection sampling, so no code is more likely than another. */
export function generateLoginCode(
  random: (buffer: Uint32Array) => Uint32Array = (buffer) => crypto.getRandomValues(buffer),
): string {
  const ceiling = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  for (;;) {
    const [value = ceiling] = random(new Uint32Array(1));
    if (value < ceiling) return String(value % 1_000_000).padStart(6, '0');
  }
}

/** A fresh, unguessable value for the same-browser cookie. */
export function newLoginDevice(): string {
  return toBase64Url(randomBytes(32));
}

/** Server-minted proof that a device value came from our own send action, not a forged form field. */
export async function loginDeviceTicket(email: string, device: string): Promise<string> {
  return `${device}.${await hmac(`ticket|${email}|${device}`)}`;
}

/** Return the device value inside a valid ticket for this email, or null. */
export async function openLoginDeviceTicket(
  email: string,
  ticket: unknown,
): Promise<string | null> {
  if (typeof ticket !== 'string' || ticket.length > 200) return null;
  const [device, signature, extra] = ticket.split('.');
  if (!device || !signature || extra !== undefined) return null;
  return constantTimeEqual(signature, await hmac(`ticket|${email}|${device}`)) ? device : null;
}

/** KV key from a keyed hash: a leaked namespace does not reveal or confirm email addresses. */
async function storeKey(email: string): Promise<string> {
  return `auth:code:${await hmac(`key|${email}`)}`;
}

/**
 * Bind a new code to this magic-link token and device. One record per email, so issuing a new code
 * replaces (and so invalidates) the previous one.
 */
export async function issueLoginCode(
  email: string,
  token: string,
  device: string,
  now = Date.now(),
): Promise<string> {
  const code = generateLoginCode();
  const id = toBase64Url(randomBytes(16));
  const iv = randomBytes(12);
  const { enc } = await keys();
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(`${email}|${id}`) },
    enc,
    encoder.encode(token),
  );
  const record: StoredCode = {
    v: 1,
    id,
    mac: await hmac(`code|${id}|${email}|${code}`),
    device: await hmac(`device|${id}|${device}`),
    iv: toBase64Url(iv),
    token: toBase64Url(new Uint8Array(sealed)),
    exp: now + loginCodeTtlSeconds * 1000,
  };
  await cacheWrite(await storeKey(email), record, loginCodeTtlSeconds);
  return code;
}

async function openToken(email: string, record: StoredCode): Promise<string | null> {
  try {
    const { enc } = await keys();
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64Url(record.iv),
        additionalData: encoder.encode(`${email}|${record.id}`),
      },
      enc,
      fromBase64Url(record.token),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/**
 * Exchange a code for its magic-link token. Every outcome other than success looks the same to the
 * caller (unknown email, deleted account, expired, wrong code, wrong device). Throws the standard
 * E_RATE_LIMITED ApiError when the per-IP or per-email quota is spent.
 */
export async function redeemLoginCode(input: {
  email: string;
  code: string;
  device?: string;
  ip: string;
  now?: number;
}): Promise<RedeemResult> {
  const now = input.now ?? Date.now();
  // DESIGN-GAP: requestIp() answers 'unknown' for every visitor on hosts without a trusted proxy
  // header (Cloudflare production today); one shared bucket would cap code sign-in for the whole
  // site, so only real addresses get the IP dimension. Per-email and per-code limits always apply.
  const [byIp, byEmail] = await Promise.all([
    input.ip === 'unknown' ? null : ratelimit('magic.code', `ip:${input.ip}`),
    ratelimit('magic.code', `email:${input.email}`),
  ]);
  if (byIp) assertRateLimit(byIp, now);
  assertRateLimit(byEmail, now);
  if (!input.device || !/^\d{6}$/.test(input.code)) return { ok: false };
  // Count first, verify second: the D1 insert is conditional and atomic, and the count read back
  // includes every concurrent attempt, so at most five guesses per code can ever be checked.
  const attempt = await ratelimit('magic.code', `attempt:${input.email}|${input.device}`);
  const used = attempt.limit - attempt.remaining;
  const key = await storeKey(input.email);
  const record = await cacheRead<StoredCode>(key);
  const id = record?.id ?? 'missing';
  const [mac, device] = await Promise.all([
    hmac(`code|${id}|${input.email}|${input.code}`),
    hmac(`device|${id}|${input.device}`),
  ]);
  // Both comparisons always run, against a placeholder when there is no record.
  const codeMatches = constantTimeEqual(mac, record?.mac ?? device);
  const deviceMatches = constantTimeEqual(device, record?.device ?? mac);
  const allowed = attempt.success && used <= maxLoginCodeAttempts;
  if (allowed && record && codeMatches && deviceMatches && record.exp > now) {
    await cacheDelete(key);
    const token = await openToken(input.email, record);
    return token ? { ok: true, token } : { ok: false };
  }
  const attemptsLeft = allowed ? maxLoginCodeAttempts - used : 0;
  if (attemptsLeft <= 0) {
    // A spent code is void even if the right digits arrive later. Only the browser holding the
    // code's device value can void it, so a stranger cannot cancel someone else's pending code.
    if (record && deviceMatches) await cacheDelete(key);
    return { ok: false, attemptsLeft: 0, exhausted: true };
  }
  return { ok: false, attemptsLeft };
}
