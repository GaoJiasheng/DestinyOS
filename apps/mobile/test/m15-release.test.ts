import { releaseEnvironment, validateProduction } from '../release/production';
import manifest from '../release/privacy-manifest.json';
const production = {
  APP_VARIANT: 'production',
  EAS_PROJECT_ID: '11111111-2222-3333-4444-555555555555',
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~1111111111',
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
  EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID: 'ca-app-pub-1111111111111111/1111111111',
  EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_ID: 'ca-app-pub-1111111111111111/2222222222',
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_fixture',
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_fixture',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'fixture.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: 'fixture.apps.googleusercontent.com',
  EXPO_PUBLIC_APPLE_SERVICE_ID: 'pub.gavin.tianji.web',
  EXPO_PUBLIC_SENTRY_DSN: 'https://fixture@sentry.example/1',
  SENTRY_ORG: 'fixture',
  SENTRY_PROJECT: 'fixture',
};
it('keeps local builds usable and allows absent production services with disabled providers', () => {
  expect(() => validateProduction({})).not.toThrow();
  expect(() => validateProduction(production)).not.toThrow();
  for (const key of Object.keys(production).filter((key) => key !== 'APP_VARIANT')) {
    expect(() => validateProduction({ ...production, [key]: undefined })).not.toThrow();
    expect(() => validateProduction({ ...production, [key]: 'invalid!' })).toThrow(key);
  }
});
it.each([
  'EXPO_PUBLIC_M14_AUDIT',
  'EXPO_PUBLIC_REVENUECAT_TEST_API_KEY',
  'EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY',
])('blocks diagnostic production configuration %s', (key) => {
  expect(() => validateProduction({ ...production, [key]: 'true' })).toThrow(key);
});
it('rejects Google sample app and ad unit IDs in production', () => {
  expect(() =>
    validateProduction({
      ...production,
      EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-3940256099942544~1458002511',
    }),
  ).toThrow();
  expect(() =>
    validateProduction({
      ...production,
      EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_ID: 'ca-app-pub-3940256099942544/2247696110',
    }),
  ).toThrow();
});
it('declares advertising tracking without labeling birth data or purchases as tracking', () => {
  expect(manifest.NSPrivacyTracking).toBe(true);
  for (const kind of ['OtherUserContent', 'OtherDataTypes', 'EmailAddress', 'PurchaseHistory']) {
    expect(
      manifest.NSPrivacyCollectedDataTypes.find(
        (entry) => entry.NSPrivacyCollectedDataType === `NSPrivacyCollectedDataType${kind}`,
      )?.NSPrivacyCollectedDataTypeTracking,
    ).toBe(false);
  }
  expect(
    manifest.NSPrivacyAccessedAPITypes.find((entry) =>
      entry.NSPrivacyAccessedAPIType.endsWith('UserDefaults'),
    )?.NSPrivacyAccessedAPITypeReasons,
  ).toContain('1C8F.1');
});

it('locks production API origin and limits development HTTP to loopback', () => {
  expect(
    releaseEnvironment({ APP_VARIANT: 'production', API_BASE_URL: 'http://127.0.0.1:8787' }),
  ).toEqual({ production: true, apiBaseUrl: 'https://tianji.gavin.pub' });
  expect(
    releaseEnvironment({ APP_VARIANT: 'development', API_BASE_URL: 'http://127.0.0.1:8787' })
      .apiBaseUrl,
  ).toBe('http://127.0.0.1:8787');
  for (const API_BASE_URL of [
    'http://example.test',
    'https://user:password@example.test',
    'https://example.test/path',
    'https://example.test/?token=x',
  ])
    expect(() => releaseEnvironment({ API_BASE_URL })).toThrow('API_BASE_URL');
});
