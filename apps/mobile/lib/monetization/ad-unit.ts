import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';
/** Development uses Google's test inventory; release binaries use only provisioned native units. */
export function nativeAdUnit(): string | null {
  if (__DEV__) return TestIds.NATIVE;
  const id =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_ID;
  return id && /^ca-app-pub-\d{16}\/\d{10}$/.test(id) && !id.includes('3940256099942544')
    ? id
    : null;
}
