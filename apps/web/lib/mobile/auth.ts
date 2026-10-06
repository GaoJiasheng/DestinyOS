import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { getDb } from '../db';
import { atomicBatch, guard, insertRow, updateRows, statement } from '../db-batch';
import { ApiError } from '../api-error';
import { roleForEmail } from '../auth-role';
import { sendMagicEmail } from '../auth-email';
import { assertRateLimit, ratelimit } from '../ratelimit';
import {
  challengeSchema,
  oauthSchema,
  magicSchema,
  magicRequestSchema,
  refreshSchema,
  deviceSchema,
} from './schema';
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const ACCESS_SECONDS = 900;
const REFRESH_SECONDS = 60 * 86400;
/** SHA-256 digest of high-entropy credentials; raw tokens never enter persisted state. */
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
const unavailable = () => new ApiError('E_UNAUTHORIZED', 'Invalid or expired credential', 401);
const challengeState = challengeSchema.extend({ nonceHash: z.string(), expires: z.number() });
/** Issue a five-minute server nonce bound to an S256 PKCE challenge and the intended device. */
export async function beginOAuth(raw: unknown) {
  const input = challengeSchema.parse(raw),
    nonce = randomToken(),
    id = randomUUID();
  await getDb().ephemeralState.create({
    data: {
      key: `mobile:challenge:${id}`,
      value: JSON.stringify({
        ...input,
        nonceHash: tokenHash(nonce),
        expires: Date.now() + 300000,
      }),
      expiresAt: Date.now() + 300000,
    },
  });
  return { challengeId: id, nonce, expiresIn: 300 };
}
function credentials() {
  const accessToken = randomToken(),
    refreshToken = randomToken(),
    now = Date.now();
  return {
    response: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_SECONDS,
      refreshExpiresIn: REFRESH_SECONDS,
    },
    data: {
      accessTokenHash: tokenHash(accessToken),
      refreshTokenHash: tokenHash(refreshToken),
      accessExpiresAt: new Date(now + ACCESS_SECONDS * 1000),
      refreshExpiresAt: new Date(now + REFRESH_SECONDS * 1000),
      lastUsedAt: new Date(now),
    },
  };
}
/** Persist a hashed device session, optionally atomically consuming a login credential. */
export async function issueSession(
  userId: string,
  raw: unknown,
  consume: ReturnType<typeof statement>[] = [],
) {
  const device = deviceSchema.parse(raw),
    pair = credentials(),
    sessionId = randomUUID();
  await atomicBatch([
    ...guard('EXISTS (SELECT 1 FROM "User" WHERE id=? AND "deletedAt" IS NULL)', userId),
    ...consume,
    insertRow('MobileSession', { id: sessionId, userId, ...device, ...pair.data }),
  ]);
  return { ...pair.response, sessionId, userId };
}
/** Verify provider JWT signature, issuer, audience, nonce and one-time PKCE before creating a device session. */
export async function exchangeOAuth(provider: 'apple' | 'google', raw: unknown) {
  const input = oauthSchema.parse(raw),
    db = getDb();
  const row = await db.ephemeralState.findUnique({
    where: { key: `mobile:challenge:${input.challengeId}` },
  });
  if (!row || row.expiresAt <= Date.now()) throw unavailable();
  const challenge = challengeState.parse(JSON.parse(row.value));
  if (
    challenge.provider !== provider ||
    challenge.expires <= Date.now() ||
    createHash('sha256').update(input.codeVerifier).digest('base64url') !== challenge.codeChallenge
  )
    throw unavailable();
  const audience =
    provider === 'apple'
      ? [
          'pub.gavin.tianji',
          ...(process.env.MOBILE_APPLE_CLIENT_IDS?.split(',').filter(Boolean) ?? []),
        ]
      : process.env.MOBILE_GOOGLE_CLIENT_IDS?.split(',').filter(Boolean);
  if (!audience?.length) throw new ApiError('E_INTERNAL', 'OAuth audience not configured', 503);
  let identity: { sub: string; email?: string };
  try {
    const { payload } = await jwtVerify(
      input.idToken,
      provider === 'apple' ? appleKeys : googleKeys,
      {
        issuer:
          provider === 'apple'
            ? 'https://appleid.apple.com'
            : ['https://accounts.google.com', 'accounts.google.com'],
        audience,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'iat', 'exp', 'nonce'],
        maxTokenAge: '10m',
      },
    );
    if (
      typeof payload.nonce !== 'string' ||
      !(
        tokenHash(payload.nonce) === challenge.nonceHash ||
        (provider === 'apple' && payload.nonce === challenge.nonceHash)
      )
    )
      throw unavailable();
    const claims = z
      .object({
        sub: z.string().min(1).max(255),
        email: z.string().email().optional(),
        email_verified: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
      })
      .parse(payload);
    if (claims.email && claims.email_verified !== true && claims.email_verified !== 'true')
      throw unavailable();
    identity = claims;
  } catch {
    throw unavailable();
  }
  let account = await db.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: identity.sub } },
    include: { user: true },
  });
  if (!account) {
    if (!identity.email) throw unavailable();
    // DESIGN-GAP: Never auto-link OAuth to an existing email account. Require an authenticated linking flow to prevent provider account takeover.
    if (await db.user.findUnique({ where: { email: identity.email.toLowerCase() } }))
      throw new ApiError('E_CONFLICT', 'Sign in using the existing account provider', 409);
    const userId = randomUUID();
    try {
      await atomicBatch([
        ...guard(
          'EXISTS (SELECT 1 FROM "EphemeralState" WHERE key=? AND value=? AND "expiresAt">?)',
          row.key,
          row.value,
          Date.now(),
        ),
        insertRow('User', {
          id: userId,
          email: identity.email.toLowerCase(),
          emailVerified: new Date(),
          locale: input.locale,
          role: roleForEmail(identity.email),
        }),
        insertRow('Account', { userId, type: 'oidc', provider, providerAccountId: identity.sub }),
      ]);
    } catch {
      account = await db.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId: identity.sub } },
        include: { user: true },
      });
      if (!account) throw new ApiError('E_CONFLICT', 'Concurrent sign-in; retry', 409);
    }
    account ??= await db.account.findUniqueOrThrow({
      where: { provider_providerAccountId: { provider, providerAccountId: identity.sub } },
      include: { user: true },
    });
  }
  if (account.user.deletedAt) throw unavailable();
  try {
    return await issueSession(account.userId, challenge, [
      ...guard(
        'EXISTS (SELECT 1 FROM "EphemeralState" WHERE key=? AND value=? AND "expiresAt">?)',
        row.key,
        row.value,
        Date.now(),
      ),
      statement('DELETE FROM "EphemeralState" WHERE key=? AND value=?', row.key, row.value),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'E_CONFLICT') throw unavailable();
    throw error;
  }
}
/** Send the existing next-intl email template with the universal-link confirmation route. */
export async function requestMagic(raw: unknown, ip: string) {
  const input = magicRequestSchema.parse(raw);
  assertRateLimit(await ratelimit('magic.email', input.email));
  assertRateLimit(await ratelimit('magic.ip', ip));
  const token = randomToken(),
    secret = process.env.AUTH_SECRET;
  if (!secret) throw new ApiError('E_INTERNAL', 'Authentication unavailable', 503);
  // DESIGN-GAP: Match Auth.js's SHA-256(token + secret) so the same email credential also verifies on the Web fallback.
  const hashed = tokenHash(`${token}${secret}`);
  const url = new URL(
    '/auth/verify',
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tianji.gavin.pub',
  );
  url.searchParams.set('token', token);
  url.searchParams.set('email', input.email);
  url.searchParams.set('locale', input.locale);
  await getDb().verificationToken.create({
    data: { identifier: input.email, token: hashed, expires: new Date(Date.now() + 900000) },
  });
  try {
    await sendMagicEmail(input.email, input.locale, url.toString());
  } catch (error) {
    await getDb().verificationToken.deleteMany({ where: { token: hashed } });
    throw error;
  }
  return { sent: true };
}
/** Consume an Auth.js-compatible magic credential in the same atomic batch as session issuance. */
export async function exchangeMagic(raw: unknown) {
  const input = magicSchema.parse(raw),
    secret = process.env.AUTH_SECRET;
  if (!secret) throw new ApiError('E_INTERNAL', 'Authentication unavailable', 503);
  const hash = tokenHash(`${input.token}${secret}`),
    db = getDb();
  const token = await db.verificationToken.findUnique({ where: { token: hash } });
  if (!token || token.identifier !== input.email || token.expires <= new Date())
    throw unavailable();
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing?.deletedAt) throw unavailable();
  const id = existing?.id ?? randomUUID();
  try {
    return await issueMagicBatch();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'E_CONFLICT') throw unavailable();
    throw error;
  }
  async function issueMagicBatch() {
    const pair = credentials(),
      sessionId = randomUUID();
    await atomicBatch([
      ...guard(
        'EXISTS (SELECT 1 FROM "VerificationToken" WHERE token=? AND identifier=? AND julianday(expires)>julianday(?))',
        hash,
        input.email,
        new Date().toISOString(),
      ),
      statement(
        'DELETE FROM "VerificationToken" WHERE token=? AND identifier=?',
        hash,
        input.email,
      ),
      ...(existing
        ? [
            ...guard('EXISTS (SELECT 1 FROM "User" WHERE id=? AND "deletedAt" IS NULL)', id),
            updateRows('User', { emailVerified: new Date() }, 'id=?', id),
          ]
        : [
            insertRow('User', {
              id,
              email: input.email,
              emailVerified: new Date(),
              locale: input.locale,
              role: roleForEmail(input.email),
            }),
          ]),
      insertRow('MobileSession', {
        id: sessionId,
        userId: id,
        deviceName: input.deviceName,
        platform: input.platform,
        ...pair.data,
      }),
    ]);
    return { ...pair.response, sessionId, userId: id };
  }
}
/** Rotate a refresh credential atomically; only one concurrent consumer succeeds, and old access tokens expire immediately. */
export async function refreshSession(raw: unknown) {
  const { refreshToken } = refreshSchema.parse(raw),
    db = getDb(),
    now = new Date();
  const row = await db.mobileSession.findUnique({
    where: { refreshTokenHash: tokenHash(refreshToken) },
    include: { user: true },
  });
  if (!row || row.refreshExpiresAt <= now || row.user.deletedAt) throw unavailable();
  const pair = credentials();
  try {
    await atomicBatch([
      ...guard(
        'EXISTS (SELECT 1 FROM "MobileSession" s JOIN "User" u ON u.id=s."userId" WHERE s.id=? AND s."refreshTokenHash"=? AND s.rotation=? AND julianday(s."refreshExpiresAt")>julianday(?) AND u."deletedAt" IS NULL)',
        row.id,
        row.refreshTokenHash,
        row.rotation,
        now.toISOString(),
      ),
      updateRows(
        'MobileSession',
        { ...pair.data, rotation: row.rotation + 1 },
        'id=? AND "refreshTokenHash"=?',
        row.id,
        row.refreshTokenHash,
      ),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'E_CONFLICT') throw unavailable();
    throw error;
  }
  return { ...pair.response, sessionId: row.id, userId: row.userId };
}
/** Resolve a live mobile Bearer token exclusively; Web cookies and refresh tokens grant no API access. */
export async function mobileOwner(request: Request) {
  const match = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match) throw unavailable();
  const row = await getDb().mobileSession.findUnique({
    where: { accessTokenHash: tokenHash(match[1]!) },
    include: { user: true },
  });
  if (!row || row.accessExpiresAt <= new Date() || row.user.deletedAt) throw unavailable();
  await getDb().mobileSession.updateMany({
    where: { id: row.id, lastUsedAt: { lt: new Date(Date.now() - 60000) } },
    data: { lastUsedAt: new Date() },
  });
  return { user: row.user, sessionId: row.id };
}
