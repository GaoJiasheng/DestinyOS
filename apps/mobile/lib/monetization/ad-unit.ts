import { Platform } from 'react-native';
/** Development uses Google's test inventory; release binaries use only provisioned native units. */
export function nativeAdUnit(): string | null {
  // DESIGN-GAP: Use the installed SDK's documented test inventory without importing its mandatory native module during production boot.
  if (__DEV__)
    return Platform.OS === 'ios'
      ? 'ca-app-pub-3940256099942544/3986624511'
      : 'ca-app-pub-3940256099942544/2247696110';
  const id =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_ID;
  const appId =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
  return appId &&
    /^ca-app-pub-\d{16}~\d{10}$/.test(appId) &&
    !appId.includes('3940256099942544') &&
    id &&
    /^ca-app-pub-\d{16}\/\d{10}$/.test(id) &&
    !id.includes('3940256099942544')
    ? id
    : null;
}
