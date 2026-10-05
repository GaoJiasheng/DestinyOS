import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const mock = vi.hoisted(() => ({ create: vi.fn(), request: vi.fn() }));
vi.mock('../lib/db', () => ({ getDb: () => ({ session: { create: mock.create } }) }));
import { handlers } from '../lib/auth';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('requires OAuth state, PKCE and nonce and rejects missing/forged state before token exchange', async () => {
  vi.stubEnv('AUTH_SECRET', 'isolated-oauth-security-secret');
  vi.stubEnv('AUTH_TRUST_HOST', 'true');
  vi.stubEnv('AUTH_GOOGLE_ID', 'audit-client');
  vi.stubEnv('AUTH_GOOGLE_SECRET', 'audit-secret');
  vi.stubEnv('NODE_ENV', 'test');
  const discovery = {
    issuer: 'https://accounts.google.com',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
  };
  mock.request.mockImplementation(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.endsWith('/.well-known/openid-configuration'))
      throw new Error('Unexpected token exchange');
    return Response.json(discovery);
  });
  vi.stubGlobal('fetch', mock.request);
  const origin = 'http://localhost:3100';
  const csrf = await handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
  const body: unknown = await csrf.json();
  if (
    !body ||
    typeof body !== 'object' ||
    !('csrfToken' in body) ||
    typeof body.csrfToken !== 'string'
  )
    throw new Error('Missing CSRF token');
  const jar = new NextResponse(null, { headers: csrf.headers }).cookies.getAll();
  const login = await handlers.POST(
    new NextRequest(`${origin}/api/auth/signin/google`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: jar.map((c) => `${c.name}=${c.value}`).join('; '),
      },
      body: new URLSearchParams({ csrfToken: body.csrfToken, callbackUrl: '/zh' }),
    }),
  );
  const target = new URL(login.headers.get('location') ?? 'http://invalid');
  expect(target.origin).toBe('https://accounts.google.com');
  expect(target.searchParams.get('state')).toBeTruthy();
  expect(target.searchParams.get('nonce')).toBeTruthy();
  expect(target.searchParams.get('code_challenge_method')).toBe('S256');
  const checkCookies = new NextResponse(null, { headers: login.headers }).cookies.getAll();
  const cookie = checkCookies.map((c) => `${c.name}=${c.value}`).join('; ');
  for (const state of ['', '&state=forged']) {
    mock.request.mockClear();
    const response = await handlers.GET(
      new NextRequest(`${origin}/api/auth/callback/google?code=audit${state}`, {
        headers: { cookie },
      }),
    );
    expect(response.headers.get('location')).toContain('error=');
    expect(mock.request.mock.calls.every(([url]) => String(url).includes('.well-known'))).toBe(
      true,
    );
    expect(mock.create).not.toHaveBeenCalled();
  }
});
