/* global module, process */
// @ts-check
// DESIGN-GAP: GMA validates its App ID at native load time, before JS consent gates.
// Remove the platform SDK entirely when an unconfigured production binary is built.
const production =
  process.env.APP_VARIANT === 'production' || process.env.EAS_BUILD_PROFILE === 'production';
const membership = process.env.EXPO_PUBLIC_FEATURE_MEMBERSHIP === 'true';
const nativeRelease = production || process.env.CONFIGURATION === 'Release';
/** @param {string | undefined} value */
const realAppId = (value) =>
  Boolean(value && /^ca-app-pub-\d{16}~\d{10}$/.test(value) && !value.includes('3940256099942544'));
module.exports = {
  dependencies: {
    'react-native-purchases': { platforms: membership ? {} : { ios: null, android: null } },
    'expo-tracking-transparency': { platforms: membership ? {} : { ios: null, android: null } },
    'react-native-google-mobile-ads': {
      platforms: {
        ...(!membership || (nativeRelease && !realAppId(process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID))
          ? { ios: null }
          : {}),
        ...(!membership ||
        (nativeRelease && !realAppId(process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID))
          ? { android: null }
          : {}),
      },
    },
  },
};
