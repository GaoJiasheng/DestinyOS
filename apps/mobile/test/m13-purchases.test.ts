import Purchases, {
  PRODUCT_CATEGORY,
  type PurchasesStoreProduct,
  type CustomerInfo,
} from 'react-native-purchases';
import { Linking, Platform } from 'react-native';
import { createPurchasesProvider, revenuecatKey } from '../lib/monetization/purchases';
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());
it('configures the exact User.id, changes identities with login and never attaches PII attributes', async () => {
  const provider = createPurchasesProvider('test_local_fixture');
  await expect(provider.identify('')).rejects.toThrow('E_UNAUTHORIZED');
  await provider.identify('web-user-1');
  expect(Purchases.configure).toHaveBeenCalledWith({
    apiKey: 'test_local_fixture',
    appUserID: 'web-user-1',
  });
  await provider.identify('web-user-2');
  expect(Purchases.logIn).toHaveBeenCalledWith('web-user-2');
  expect(Purchases.configure).toHaveBeenCalledTimes(1);
});
it('fetches the documented subscription and non-consumable, using store-localized price and Google base-plan suffix', async () => {
  const monthly = {
    identifier: 'tianji_pro_monthly:monthly',
    priceString: 'S$3.98',
  } as PurchasesStoreProduct;
  const lifetime = {
    identifier: 'tianji_pro_lifetime',
    priceString: 'S$9.98',
  } as PurchasesStoreProduct;
  jest
    .mocked(Purchases.getProducts)
    .mockResolvedValueOnce([monthly])
    .mockResolvedValueOnce([lifetime]);
  const provider = createPurchasesProvider('test_local_fixture');
  await provider.identify('web-user-id');
  expect(await provider.offerings()).toEqual([
    { id: 'tianji_pro_monthly', price: monthly.priceString },
    { id: 'tianji_pro_lifetime', price: lifetime.priceString },
  ]);
  expect(Purchases.getProducts).toHaveBeenCalledWith(
    ['tianji_pro_monthly'],
    PRODUCT_CATEGORY.SUBSCRIPTION,
  );
  expect(Purchases.getProducts).toHaveBeenCalledWith(
    ['tianji_pro_lifetime'],
    PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
  const info = { entitlements: { active: {} } } as CustomerInfo;
  jest
    .mocked(Purchases.purchaseStoreProduct)
    .mockResolvedValue({ customerInfo: info } as Awaited<
      ReturnType<typeof Purchases.purchaseStoreProduct>
    >);
  await provider.purchase('tianji_pro_monthly');
  expect(Purchases.purchaseStoreProduct).toHaveBeenCalledWith(monthly);
  const unsubscribe = provider.listen(jest.fn());
  unsubscribe();
  expect(Purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(
    jest.mocked(Purchases.addCustomerInfoUpdateListener).mock.calls[0]?.[0],
  );
});
it.each(['ios', 'android'] as const)(
  'opens supported subscription management on %s without calling an iOS-only API on Android',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const provider = createPurchasesProvider('test_local_fixture');
    await provider.identify('web-user-id');
    await provider.manage();
    if (platform === 'android') {
      expect(open).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions');
      expect(Purchases.showManageSubscriptions).not.toHaveBeenCalled();
    } else {
      expect(Purchases.showManageSubscriptions).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
    }
  },
);
it('missing keys do not invent a RevenueCat project or silently grant test access', () => {
  const previous = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  const ios = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  delete process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  expect(revenuecatKey()).toBeUndefined();
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY = 'test_fixture';
  expect(revenuecatKey()).toBe('test_fixture');
  if (previous === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  else process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY = previous;
  if (ios === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  else process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = ios;
});
