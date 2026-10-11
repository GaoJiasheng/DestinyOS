import { Platform } from 'react-native';
import { nativeAdUnit } from '../lib/monetization/ad-unit';
const originalDev = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', { value: originalDev, configurable: true });
  jest.restoreAllMocks();
  delete process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID;
  delete process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
  delete process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID;
  delete process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_ID;
});
it('uses test inventory in development only', () => {
  expect(nativeAdUnit()).toBe('ca-app-pub-3940256099942544/3986624511');
});
it.each(['ios', 'android'] as const)(
  'requires a real native unit on %s release binaries',
  (platform) => {
    Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true });
    jest.replaceProperty(Platform, 'OS', platform);
    expect(nativeAdUnit()).toBeNull();
    const key =
      platform === 'ios'
        ? 'EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID'
        : 'EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_ID';
    process.env[key] = 'ca-app-pub-3940256099942544/2247696110';
    expect(nativeAdUnit()).toBeNull();
    process.env[key] = 'ca-app-pub-1111111111111111/2222222222';
    expect(nativeAdUnit()).toBeNull();
    const appKey =
      platform === 'ios' ? 'EXPO_PUBLIC_ADMOB_IOS_APP_ID' : 'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID';
    process.env[appKey] = 'ca-app-pub-1111111111111111~2222222222';
    expect(nativeAdUnit()).toBe(process.env[key]);
  },
);
