import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('../lib/data/preferences-storage', () => ({
  encryptedPreferencesStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

// expo-crypto extends native AES classes at module scope, which some jest environments do not provide,
// so every suite reaching the local store failed to load. Node's crypto backs the same API here;
// a suite that needs fixed ids still declares its own mock.
jest.mock('expo-crypto', () => {
  const node = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { BASE64: 'base64', HEX: 'hex' },
    randomUUID: () => node.randomUUID(),
    getRandomBytes: (size: number) => new Uint8Array(node.randomBytes(size)),
    getRandomBytesAsync: async (size: number) => new Uint8Array(node.randomBytes(size)),
    digestStringAsync: async (
      _algorithm: string,
      data: string,
      options?: { encoding?: 'base64' | 'hex' },
    ) =>
      node
        .createHash('sha256')
        .update(data)
        .digest(options?.encoding ?? 'hex'),
  };
});
jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));
// Native monetization modules are replaced at the SDK boundary; M13 tests exercise policy and lifecycle separately.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    VERIFICATION_RESULT: { NOT_REQUESTED: 'NOT_REQUESTED' },
    configure: jest.fn(),
    logIn: jest.fn(async () => ({})),
    setLogLevel: jest.fn(async () => {}),
    getProducts: jest.fn(async () => []),
    getCustomerInfo: jest.fn(),
    invalidateCustomerInfoCache: jest.fn(async () => {}),
    purchaseStoreProduct: jest.fn(),
    restorePurchases: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    showManageSubscriptions: jest.fn(async () => {}),
  },
  PRODUCT_CATEGORY: { SUBSCRIPTION: 'SUBSCRIPTION', NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
  LOG_LEVEL: { ERROR: 'ERROR' },
}));
jest.mock('react-native-google-mobile-ads', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: () => ({
      setRequestConfiguration: jest.fn(async () => {}),
      initialize: jest.fn(async () => {}),
    }),
    NativeAd: {
      createForAdRequest: jest.fn(async () => ({
        headline: 'Test native creative',
        body: 'Test body',
        callToAction: 'Test action',
        destroy: jest.fn(),
      })),
    },
    NativeAdView: View,
    NativeAsset: View,
    NativeMediaView: View,
    NativeAssetType: {
      HEADLINE: 'headline',
      BODY: 'body',
      ICON: 'icon',
      CALL_TO_ACTION: 'callToAction',
    },
    TestIds: { NATIVE: 'test-native' },
    AgeRestrictedTreatment: { TEEN: 'teen', UNSPECIFIED: 'unspecified' },
    MaxAdContentRating: { T: 'T' },
    AdsConsent: {
      gatherConsent: jest.fn(),
      getUserChoices: jest.fn(),
      showPrivacyOptionsForm: jest.fn(async () => {}),
    },
    AdsConsentStatus: { OBTAINED: 'OBTAINED', NOT_REQUIRED: 'NOT_REQUIRED' },
    AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
    AdsConsentDebugGeography: { EEA: 1, REGULATED_US_STATE: 3 },
  };
});
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureEvent: jest.fn(),
  wrap: (component: unknown) => component,
}));
// Reanimated's worklet runtime is not available in jest; the swipe container renders its row and its right action inline.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = jest.requireActual('react-native');
  const { createElement } = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
    }: {
      children: unknown;
      renderRightActions?: (p: unknown, t: unknown, m: { close: () => void }) => unknown;
    }) =>
      createElement(
        View,
        null,
        children,
        renderRightActions?.(null, null, { close: () => undefined }),
      ),
  };
});
