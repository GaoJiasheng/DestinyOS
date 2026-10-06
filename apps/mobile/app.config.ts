import type { ExpoConfig } from 'expo/config';
import { brand } from '@tianji/shared/brand';
import { designTokens } from '@tianji/ui-core/tokens';
// DESIGN-GAP: Keep TypeScript 5.9 per docs/09; Expo's suggested TS6 upgrade is excluded from version checks.
// SDK57 requires the new architecture; there is no legacy architecture switch.
const config: ExpoConfig = {
  name: brand.nameZh,
  slug: 'tianji',
  version: '0.1.0',
  // DESIGN-GAP: Use a brand-based custom scheme for development links; production auth uses documented HTTPS universal links.
  scheme: 'tianji',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: 'pub.gavin.tianji',
    appleTeamId: 'D33974QQTD',
    supportsTablet: true,
    associatedDomains: [`applinks:${brand.domain}`],
    entitlements: { 'com.apple.security.application-groups': ['group.pub.gavin.tianji'] },
    infoPlist: {
      CFBundleLocalizations: ['zh-Hans', 'zh-Hant', 'en'],
      ITSAppUsesNonExemptEncryption: false,
      // DESIGN-GAP: Hide Expo's development-only overlay during native E2E and screenshots;
      // developers can still open the menu with keyboard/gesture controls.
      EXDevMenuShowFloatingActionButton: false,
      EXDevMenuShowsAtLaunch: false,
      EXDevMenuIsOnboardingFinished: true,
    },
  },
  android: { package: 'pub.gavin.tianji', predictiveBackGestureEnabled: true },
  plugins: [
    // DESIGN-GAP: SDK57's cached RNCore Release binary omits RCTPackagerConnection during
    // a subsequent Debug link. Source builds keep development/production symbols consistent.
    ['expo-build-properties', { ios: { buildReactNativeFromSource: true } }],
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
        enableBackgroundRecording: false,
      },
    ],
    'expo-router',
    'expo-asset',
    'expo-notifications',
    '@react-native-community/datetimepicker',
    ['expo-sqlite', { useSQLCipher: true }],
    ['expo-secure-store', { configureAndroidBackup: true }],
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/wenkai.ttf',
          './assets/fonts/noto.ttf',
          './assets/fonts/cinzel.ttf',
          './assets/fonts/cormorant.ttf',
          './assets/fonts/inter.ttf',
        ],
      },
    ],
    ['expo-splash-screen', { backgroundColor: designTokens.base['bg-0'] }],
  ],
  experiments: { typedRoutes: true },
};
export default config;
