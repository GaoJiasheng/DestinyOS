import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import * as Apple from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  createApiClient,
  mobileChallengeEndpoint,
  mobileOAuthEndpoint,
  mobileGoogleCodeEndpoint,
  type MobileTokens,
} from '@tianji/api-client';
import { brand } from '@tianji/shared/brand';
import type { MobileLocale } from '../i18n';
WebBrowser.maybeCompleteAuthSession();
/** First-party API always uses HTTPS; public OAuth client identifiers are configuration, never secrets. */
export const publicApi = (transport?: typeof fetch) =>
  createApiClient({ baseUrl: `https://${brand.domain}`, fetch: transport });
/** Platform/device description is bounded and contains no birth data or advertising identifiers. */
export const device = () => ({
  platform: Platform.OS === 'ios' ? ('ios' as const) : ('android' as const),
  deviceName: (Device.modelName ?? Platform.OS).slice(0, 100),
});
const googleDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};
/** Exchange provider identity using a fresh nonce and one-time server S256 PKCE binding. */
export async function signInProvider(
  provider: 'apple' | 'google',
  locale: MobileLocale,
  transport?: typeof fetch,
): Promise<MobileTokens | null> {
  const verifier =
    Crypto.randomUUID().replaceAll('-', '') + Crypto.randomUUID().replaceAll('-', '');
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const api = publicApi(transport);
  const challenge = await api.request(mobileChallengeEndpoint, {
    ...device(),
    provider,
    codeChallenge: digest.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''),
  });
  let idToken: string | undefined;
  if (provider === 'apple' && Platform.OS === 'ios') {
    if (!(await Apple.isAvailableAsync())) throw new Error('E_PROVIDER_UNAVAILABLE');
    try {
      const result = await Apple.signInAsync({
        requestedScopes: [Apple.AppleAuthenticationScope.EMAIL],
        nonce: challenge.nonce,
        state: challenge.challengeId,
      });
      if (result.state !== challenge.challengeId) throw new Error('E_UNAUTHORIZED');
      idToken = result.identityToken ?? undefined;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      )
        return null;
      throw error;
    }
  } else if (provider === 'google') {
    const clientId =
      Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
        : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    if (!clientId) throw new Error('E_PROVIDER_UNAVAILABLE');
    // DESIGN-GAP: OAuth client IDs come from the provider console; Android uses the Web client and server-held secret with an HTTPS relay.
    const redirectUri =
      Platform.OS === 'ios'
        ? `com.googleusercontent.apps.${clientId.split('.apps.googleusercontent.com')[0]}:/oauthredirect`
        : `https://${brand.domain}/auth/mobile/google`;
    if (!redirectUri) throw new Error('E_PROVIDER_UNAVAILABLE');
    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      scopes: ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      state: challenge.challengeId,
      extraParams: { nonce: challenge.nonce },
    });
    await request.makeAuthUrlAsync(googleDiscovery);
    const browserResult =
      Platform.OS === 'android'
        ? await WebBrowser.openAuthSessionAsync(request.url!, 'tianji://auth/callback')
        : null;
    const result =
      browserResult?.type === 'success'
        ? request.parseReturnUrl(browserResult.url)
        : (browserResult ?? (await request.promptAsync(googleDiscovery)));
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success' || !result.params.code || !request.codeVerifier)
      throw new Error('E_UNAUTHORIZED');
    if (Platform.OS === 'android')
      return api.request(mobileGoogleCodeEndpoint, {
        challengeId: challenge.challengeId,
        codeVerifier: verifier,
        authorizationCode: result.params.code,
        providerCodeVerifier: request.codeVerifier,
        locale,
      });
    const exchanged = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        redirectUri,
        code: result.params.code,
        extraParams: { code_verifier: request.codeVerifier },
      },
      googleDiscovery,
    );
    idToken = exchanged.idToken;
  } else {
    const clientId = process.env.EXPO_PUBLIC_APPLE_SERVICE_ID;
    if (!clientId) throw new Error('E_PROVIDER_UNAVAILABLE');
    const url = new URL('https://appleid.apple.com/auth/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `https://${brand.domain}/auth/mobile/apple`,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'email',
      state: challenge.challengeId,
      nonce: challenge.nonce,
    }).toString();
    // DESIGN-GAP: Apple on Android uses the registered HTTPS form_post relay; PKCE/nonce verification still happens at the Worker exchange.
    const result = await WebBrowser.openAuthSessionAsync(url.toString(), 'tianji://auth/callback');
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success') throw new Error('E_UNAUTHORIZED');
    const callback = new URL(result.url),
      params = new URLSearchParams(callback.hash.slice(1));
    if (
      callback.protocol !== 'tianji:' ||
      callback.host !== 'auth' ||
      callback.pathname !== '/callback' ||
      params.get('state') !== challenge.challengeId
    )
      throw new Error('E_UNAUTHORIZED');
    idToken = params.get('id_token') ?? undefined;
  }
  if (!idToken) throw new Error('E_UNAUTHORIZED');
  return api.request(mobileOAuthEndpoint(provider), {
    challengeId: challenge.challengeId,
    codeVerifier: verifier,
    idToken,
    locale,
  });
}
