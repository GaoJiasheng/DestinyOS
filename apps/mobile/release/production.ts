// DESIGN-GAP: Owner-provisioned public service IDs are required only for a production build; no backend credentials belong in app config.
type Environment = Readonly<Record<string, string | undefined>>;
const samplePublisher = 'ca-app-pub-3940256099942544';
const publicFields = {
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: /^ca-app-pub-\d{16}~\d{10}$/,
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: /^ca-app-pub-\d{16}~\d{10}$/,
  EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID: /^ca-app-pub-\d{16}\/\d{10}$/,
  EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_ID: /^ca-app-pub-\d{16}\/\d{10}$/,
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: /^appl_\w+$/,
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: /^goog_\w+$/,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: /^[\w-]+\.apps\.googleusercontent\.com$/,
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: /^[\w-]+\.apps\.googleusercontent\.com$/,
  EXPO_PUBLIC_APPLE_SERVICE_ID: /^[a-zA-Z0-9.-]+$/,
  EXPO_PUBLIC_SENTRY_DSN: /^https:\/\/[^@]+@[^/]+\/\d+$/,
  EAS_PROJECT_ID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  SENTRY_ORG: /^[\w-]+$/,
  SENTRY_PROJECT: /^[\w-]+$/,
} as const;
/** Fail before producing a store binary with absent service configuration, test inventory or audit gates. */
export function validateProduction(env: Environment): void {
  if (env.APP_VARIANT !== 'production' && env.EAS_BUILD_PROFILE !== 'production') return;
  for (const [name, pattern] of Object.entries(publicFields)) {
    const value = env[name];
    if (!value || !pattern.test(value) || value.startsWith(samplePublisher))
      throw new Error(`Production configuration requires a valid ${name}`);
  }
  for (const name of [
    'EXPO_PUBLIC_M14_AUDIT',
    'EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY',
    'EXPO_PUBLIC_REVENUECAT_TEST_API_KEY',
  ]) {
    if (env[name] && env[name] !== 'false') throw new Error(`Remove ${name} from production`);
  }
}
