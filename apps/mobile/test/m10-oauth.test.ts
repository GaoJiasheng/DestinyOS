import { Platform } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import { signInProvider } from '../lib/account/oauth';
jest.mock('expo-device', () => ({ modelName: 'Synthetic iPhone' }));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '9fba18f5-429b-463e-9d9a-55072d4c76c1',
  digestStringAsync: jest.fn(async () => 'a'.repeat(43) + '='),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { BASE64: 'base64' },
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { EMAIL: 1 },
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: () => {},
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn(),
  exchangeCodeAsync: jest.fn(),
  ResponseType: { Code: 'code' },
}));
const challengeId = '9fba18f5-429b-463e-9d9a-55072d4c76c1';
const pair = {
  accessToken: 'a'.repeat(43),
  refreshToken: 'r'.repeat(43),
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshExpiresIn: 5184000,
  sessionId: challengeId,
  userId: 'alice',
};
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
});
function transport() {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    requests.push({
      path: new URL(String(input)).pathname,
      body: JSON.parse(String(options?.body)) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        data: String(input).endsWith('auth/challenge')
          ? { challengeId, nonce: 'n'.repeat(43), expiresIn: 300 }
          : pair,
      }),
    );
  };
  return { requests, fetcher };
}
it('binds Apple identity to nonce/state and a server S256 proof; cancellation exchanges no identity', async () => {
  const { fetcher, requests } = transport();
  jest.mocked(Apple.signInAsync).mockResolvedValue({
    identityToken: 'signed-identity',
    state: challengeId,
  } as Apple.AppleAuthenticationCredential);
  expect(await signInProvider('apple', 'en', fetcher)).toEqual(pair);
  expect(Apple.signInAsync).toHaveBeenCalledWith(
    expect.objectContaining({ nonce: 'n'.repeat(43), state: challengeId }),
  );
  expect(Crypto.digestStringAsync).toHaveBeenCalled();
  expect(requests[0]?.body).toMatchObject({
    provider: 'apple',
    platform: 'ios',
    codeChallenge: 'a'.repeat(43),
  });
  expect(requests[1]?.body).toMatchObject({
    challengeId,
    idToken: 'signed-identity',
    locale: 'en',
  });
  jest.mocked(Apple.signInAsync).mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
  expect(await signInProvider('apple', 'en', fetcher)).toBeNull();
  expect(requests).toHaveLength(3);
});
it('uses Google authorization code with PKCE and exchanges the resulting ID token with the Worker', async () => {
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'public.apps.googleusercontent.com';
  const { fetcher, requests } = transport();
  jest.mocked(AuthSession.AuthRequest).mockImplementation(
    () =>
      ({
        makeAuthUrlAsync: async () => '',
        promptAsync: async () => ({ type: 'success', params: { code: 'provider-code' } }),
        codeVerifier: 'provider-verifier'.repeat(4),
      }) as unknown as AuthSession.AuthRequest,
  );
  jest
    .mocked(AuthSession.exchangeCodeAsync)
    .mockResolvedValue({ idToken: 'signed-google-identity' } as AuthSession.TokenResponse);
  await signInProvider('google', 'en', fetcher);
  expect(AuthSession.AuthRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      usePKCE: true,
      responseType: 'code',
      extraParams: { nonce: 'n'.repeat(43) },
    }),
  );
  expect(AuthSession.exchangeCodeAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'provider-code',
      extraParams: { code_verifier: 'provider-verifier'.repeat(4) },
    }),
    expect.any(Object),
  );
  expect(requests[1]?.body.idToken).toBe('signed-google-identity');
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
});
