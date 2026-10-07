import type { ExpoConfig } from 'expo/config';
import { brand } from '@tianji/shared/brand';
import en from '../web/messages/en.json';
import zh from '../web/messages/zh.json';
import zhTW from '../web/messages/zh-TW.json';
import { designTokens } from '@tianji/ui-core/tokens';
// DESIGN-GAP: Keep TypeScript 5.9 per docs/09; Expo's suggested TS6 upgrade is excluded from version checks.
// SDK57 requires the new architecture; there is no legacy architecture switch.
const config: ExpoConfig = {
  name: brand.nameZh,
  slug: 'tianji',
  version: '0.1.0',
  // DESIGN-GAP: Use a brand-based custom scheme for development links; production auth uses documented HTTPS universal links.
  scheme: [
    'tianji',
    ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? [
          `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split('.apps.googleusercontent.com')[0]}`,
        ]
      : []),
  ],
  // DESIGN-GAP: ATT's system prompt is generated from the shared next-intl catalogs using Expo's native locale resources.
  locales: {
    en: { ios: { NSUserTrackingUsageDescription: en['mobile.billing.attPurpose'] } },
    'zh-Hans': { ios: { NSUserTrackingUsageDescription: zh['mobile.billing.attPurpose'] } },
    'zh-Hant': { ios: { NSUserTrackingUsageDescription: zhTW['mobile.billing.attPurpose'] } },
  },
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: 'pub.gavin.tianji',
    appleTeamId: 'D33974QQTD',
    supportsTablet: true,
    usesAppleSignIn: true,
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
  android: {
    package: 'pub.gavin.tianji',
    predictiveBackGestureEnabled: true,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: [{ scheme: 'https', host: brand.domain, pathPrefix: '/auth/verify' }],
      },
    ],
  },
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
    // DESIGN-GAP: M13 always uses Google's public sample app IDs and native test units; production inventory is configured in a later release.
    [
      'react-native-google-mobile-ads',
      {
        iosAppId: 'ca-app-pub-3940256099942544~1458002511',
        androidAppId: 'ca-app-pub-3940256099942544~3347511713',
        androidSdk: 'classic',
        delayAppMeasurementInit: true,
      },
    ],
    ['expo-tracking-transparency', { userTrackingPermission: en['mobile.billing.attPurpose'] }],
    'expo-router',
    'expo-apple-authentication',
    'expo-web-browser',
    'expo-sharing',
    'expo-asset',
    'expo-notifications',
    'expo-background-task',
    ['@bacons/apple-targets', { root: './native', match: 'widget' }],
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'TianjiSmall',
            label: '@string/tianji_widget_title',
            minWidth: '110dp',
            minHeight: '110dp',
            targetCellWidth: 2,
            targetCellHeight: 2,
            resizeMode: 'none',
            updatePeriodMillis: 1800000,
          },
          {
            name: 'TianjiMedium',
            label: '@string/tianji_widget_title',
            minWidth: '250dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: 'none',
            updatePeriodMillis: 1800000,
          },
          {
            name: 'TianjiLarge',
            label: '@string/tianji_widget_title',
            minWidth: '250dp',
            minHeight: '250dp',
            targetCellWidth: 4,
            targetCellHeight: 4,
            resizeMode: 'none',
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
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
