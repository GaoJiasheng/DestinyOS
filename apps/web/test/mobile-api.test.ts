import { raw, request } from './mobile-fixture';
import { expect, it, vi } from 'vitest';
import { mobileApi } from '../lib/mobile/router';
import { createHash } from 'node:crypto';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';
import {
  issueSession,
  exchangeMagic,
  tokenHash,
  refreshSession,
  beginOAuth,
  exchangeOAuth,
} from '../lib/mobile/auth';
import { sendEmail } from '../lib/platform/email';
import { auth } from '../lib/auth';
import { GET as universalFallback } from '../app/auth/verify/route';
it('stores only hashes, permits Bearer access and rejects cookies, refresh tokens, expired access and revoked devices', async () => {
  const session = await issueSession('owner', { deviceName: 'iPhone', platform: 'ios' });
  const row = await raw.mobileSession.findUniqueOrThrow({ where: { id: session.sessionId } });
  expect(row.accessTokenHash).toBe(tokenHash(session.accessToken));
  expect(row.refreshTokenHash).toBe(tokenHash(session.refreshToken));
  expect(row.accessExpiresAt.getTime() - Date.now()).toBeGreaterThan(895000);
  expect(row.refreshExpiresAt.getTime() - Date.now()).toBeGreaterThan(59.99 * 86400000);
  expect((await mobileApi(request('auth/sessions'))).status).toBe(401);
  const cookie = request('auth/sessions');
  cookie.headers.set('Cookie', 'authjs.session-token=web');
  expect((await mobileApi(cookie)).status).toBe(401);
  expect(
    (await mobileApi(request('auth/sessions', 'GET', undefined, session.refreshToken))).status,
  ).toBe(401);
  const devices = (await (
    await mobileApi(request('auth/sessions', 'GET', undefined, session.accessToken))
  ).json()) as { data: { sessions: unknown[] } };
  expect(JSON.stringify(devices)).not.toMatch(/Token|Hash/);
  expect(devices.data.sessions).toHaveLength(1);
  const foreign = await issueSession('other', { deviceName: 'Pixel', platform: 'android' });
  expect(
    (
      await mobileApi(
        request('auth/sessions', 'DELETE', { sessionId: foreign.sessionId }, session.accessToken),
      )
    ).status,
  ).toBe(404);
  await raw.mobileSession.update({
    where: { id: session.sessionId },
    data: { accessExpiresAt: new Date(0) },
  });
  expect(
    (await mobileApi(request('sync/profiles', 'GET', undefined, session.accessToken))).status,
  ).toBe(401);
  expect(auth).not.toHaveBeenCalled();
});

it('atomically rotates 60-day refresh tokens once under concurrent real D1 requests', async () => {
  const session = await issueSession('owner', { deviceName: 'iPhone', platform: 'ios' });
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => refreshSession({ refreshToken: session.refreshToken })),
  );
  const good = results.filter((value) => value.status === 'fulfilled');
  expect(good).toHaveLength(1);
  expect(results.filter((value) => value.status === 'rejected')).toHaveLength(4);
  expect(
    (await mobileApi(request('auth/sessions', 'GET', undefined, session.accessToken))).status,
  ).toBe(401);
  if (good[0]?.status !== 'fulfilled') throw new Error('Expected rotation');
  const next = good[0].value;
  expect((await mobileApi(request('auth/logout', 'POST', {}, next.accessToken))).status).toBe(200);
  await expect(refreshSession({ refreshToken: next.refreshToken })).rejects.toMatchObject({
    code: 'E_UNAUTHORIZED',
  });
});

it('consumes Auth.js-compatible magic tokens once and sends localized universal links', async () => {
  const response = await mobileApi(
    request('auth/magic/request', 'POST', { email: 'owner@example.test', locale: 'en' }),
  );
  expect(response.status).toBe(200);
  expect(sendEmail).toHaveBeenCalledOnce();
  const mail = vi.mocked(sendEmail).mock.calls[0]![0];
  const url = new URL(mail.text.match(/https:\/\/\S+/)![0]);
  expect(url.pathname).toBe('/auth/verify');
  const fallback = await universalFallback(new Request(url));
  expect(fallback.status).toBe(307);
  expect(fallback.headers.get('location')).toContain('/en/auth/verify');
  expect(await raw.verificationToken.count()).toBe(1);
  const input = {
    email: 'owner@example.test',
    token: url.searchParams.get('token'),
    deviceName: 'iPhone',
    platform: 'ios',
    locale: 'en',
  };
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => exchangeMagic(input)));
  expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
  expect(await raw.verificationToken.count()).toBe(0);
  await expect(exchangeMagic(input)).rejects.toMatchObject({ code: 'E_UNAUTHORIZED' });
});

it('validates actual signed Apple/Google JWTs, nonce, S256 proof, audiences and single-use challenges', async () => {
  const key = await generateKeyPair('RS256'),
    jwk = await exportJWK(key.publicKey);
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () =>
      Response.json({ keys: [{ ...jwk, kid: 'mobile-test', alg: 'RS256', use: 'sig' }] }),
    );
  vi.stubEnv('MOBILE_GOOGLE_CLIENT_IDS', 'google-mobile');
  const wrongKey = await generateKeyPair('RS256');
  const verifier = 'a'.repeat(43),
    codeChallenge = createHash('sha256').update(verifier).digest('base64url');
  for (const provider of ['apple', 'google'] as const) {
    const challenge = await beginOAuth({
      provider,
      codeChallenge,
      deviceName: 'Device',
      platform: 'ios',
    });
    const issuer =
        provider === 'apple' ? 'https://appleid.apple.com' : 'https://accounts.google.com',
      audience = provider === 'apple' ? 'pub.gavin.tianji' : 'google-mobile';
    const jwt = await new SignJWT({
      nonce: challenge.nonce,
      email: `${provider}@example.test`,
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'mobile-test' })
      .setSubject(`${provider}-id`)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key.privateKey);
    const input = { challengeId: challenge.challengeId, codeVerifier: verifier, idToken: jwt };
    await expect(
      exchangeOAuth(provider, { ...input, codeVerifier: 'b'.repeat(43) }),
    ).rejects.toMatchObject({ code: 'E_UNAUTHORIZED' });
    const bad = await new SignJWT({
      nonce: challenge.nonce,
      email: `${provider}@example.test`,
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'mobile-test' })
      .setSubject(`${provider}-id`)
      .setIssuer(issuer)
      .setAudience('wrong-app')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key.privateKey);
    await expect(exchangeOAuth(provider, { ...input, idToken: bad })).rejects.toMatchObject({
      code: 'E_UNAUTHORIZED',
    });
    for (const failure of ['nonce', 'issuer', 'expiry', 'verification', 'signature']) {
      const altered = await new SignJWT({
        nonce: failure === 'nonce' ? 'different-nonce' : challenge.nonce,
        email: `${provider}@example.test`,
        email_verified: failure !== 'verification',
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'mobile-test' })
        .setSubject(`${provider}-id`)
        .setIssuer(failure === 'issuer' ? 'https://untrusted.example' : issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(failure === 'expiry' ? Math.floor(Date.now() / 1000) - 1 : '5m')
        .sign(failure === 'signature' ? wrongKey.privateKey : key.privateKey);
      await expect(exchangeOAuth(provider, { ...input, idToken: altered })).rejects.toMatchObject({
        code: 'E_UNAUTHORIZED',
      });
    }
    const session = await exchangeOAuth(provider, input);
    expect(session.expiresIn).toBe(900);
    const returning = await beginOAuth({
      provider,
      codeChallenge,
      deviceName: 'Return',
      platform: 'ios',
    });
    const returningJwt = await new SignJWT({ nonce: returning.nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'mobile-test' })
      .setSubject(`${provider}-id`)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key.privateKey);
    expect(
      (
        await exchangeOAuth(provider, {
          challengeId: returning.challengeId,
          codeVerifier: verifier,
          idToken: returningJwt,
        })
      ).userId,
    ).toBe(session.userId);
    await expect(exchangeOAuth(provider, input)).rejects.toMatchObject({ code: 'E_UNAUTHORIZED' });
  }
  fetcher.mockRestore();
});
