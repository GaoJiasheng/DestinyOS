import { Linking, Platform } from 'react-native';
import Purchases, {
  PRODUCT_CATEGORY,
  LOG_LEVEL,
  type PurchasesStoreProduct,
  type CustomerInfo,
} from 'react-native-purchases';
import { products, customerAccess, type Access, type ProductId } from './model';
export interface StoreProduct {
  id: ProductId;
  price: string;
}
export interface PurchaseProvider {
  identify(userId: string): Promise<void>;
  offerings(): Promise<StoreProduct[]>;
  refresh(): Promise<Access>;
  purchase(id: ProductId): Promise<Access>;
  restore(): Promise<Access>;
  listen(changed: (access: Access) => void): () => void;
  manage(): Promise<void>;
}
/** Select only the platform's public SDK key; Test Store is limited to development binaries. */
export function revenuecatKey() {
  if (__DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.startsWith('test_'))
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  return key?.startsWith(Platform.OS === 'ios' ? 'appl_' : 'goog_') ? key : undefined;
}
/** Native SDK adapter: never configure anonymously, attach PII attributes or collect ad identifiers. */
export function createPurchasesProvider(apiKey: string): PurchaseProvider {
  let configured = false;
  let available: PurchasesStoreProduct[] = [];
  return {
    async identify(userId) {
      if (!userId) throw new Error('E_UNAUTHORIZED');
      if (!configured) {
        await Purchases.setLogLevel(LOG_LEVEL.ERROR);
        Purchases.configure({ apiKey, appUserID: userId });
        configured = true;
      } else await Purchases.logIn(userId);
      available = [];
    },
    async offerings() {
      // DESIGN-GAP: Fetch the two exact products directly, avoiding reliance on an undocumented Offering ID.
      const [monthly, lifetime] = await Promise.all([
        Purchases.getProducts([products[0]], PRODUCT_CATEGORY.SUBSCRIPTION),
        Purchases.getProducts([products[1]], PRODUCT_CATEGORY.NON_SUBSCRIPTION),
      ]);
      available = [...monthly, ...lifetime];
      return available.flatMap((product) => {
        const id = products.find((item) => item === product.identifier.split(':')[0]);
        return id ? [{ id, price: product.priceString }] : [];
      });
    },
    async refresh() {
      await Purchases.invalidateCustomerInfoCache();
      return customerAccess(await Purchases.getCustomerInfo());
    },
    async purchase(id) {
      const product = available.find((item) => item.identifier.split(':')[0] === id);
      if (!product) throw new Error('E_PAYMENT');
      return customerAccess((await Purchases.purchaseStoreProduct(product)).customerInfo);
    },
    async restore() {
      return customerAccess(await Purchases.restorePurchases());
    },
    listen(changed) {
      const listener = (info: CustomerInfo) => changed(customerAccess(info));
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    },
    async manage() {
      // DESIGN-GAP: RevenueCat's sheet is iOS-only; Play's subscriptions center also lets free/lifetime users cancel an existing monthly renewal.
      if (Platform.OS === 'android')
        await Linking.openURL('https://play.google.com/store/account/subscriptions');
      else await Purchases.showManageSubscriptions();
    },
  };
}
