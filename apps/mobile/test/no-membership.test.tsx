import { render, screen } from '@testing-library/react-native';
import Purchases from 'react-native-purchases';
import { membershipEnabled } from '../lib/monetization/features';
import { nativeAdUnit } from '../lib/monetization/ad-unit';
import {
  identifyBilling,
  refreshBilling,
  billingAction,
  useBilling,
} from '../lib/monetization/billing';
import { BillingScreen } from '../components/billing-screen';
import { NativeAdCard } from '../components/native-ad-card';
import { AccountSettingsScreen } from '../components/account-screen';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('../lib/account/controller', () => ({
  accountSession: { request: jest.fn() },
  useAccount: Object.assign(
    (selector?: (state: { session: null }) => unknown) =>
      selector
        ? selector({ session: null })
        : {
            session: { userId: 'signed-in-user' },
            pending: 0,
            busy: false,
            syncing: false,
            sessions: [],
            error: null,
          },
    { getState: () => ({ mock: false }) },
  ),
}));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({ profiles: [], settings: {}, loading: false, error: false }),
}));
beforeEach(() => {
  delete process.env.EXPO_PUBLIC_FEATURE_MEMBERSHIP;
  jest.clearAllMocks();
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_FEATURE_MEMBERSHIP;
  delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
});
it('does not initialize, refresh, purchase or restore even with a configured key', async () => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'appl_unused';
  expect(membershipEnabled()).toBe(false);
  await identifyBilling('signed-in-user');
  await refreshBilling();
  await billingAction('restore');
  await billingAction('tianji_pro_monthly');
  expect(useBilling.getState()).toMatchObject({
    status: 'ready',
    configured: false,
    access: { pro: false },
    products: [],
  });
  expect(Purchases.configure).not.toHaveBeenCalled();
  expect(Purchases.restorePurchases).not.toHaveBeenCalled();
  expect(Purchases.purchaseStoreProduct).not.toHaveBeenCalled();
});
it('renders neither paywall/coming-soon text nor a native ad placeholder', () => {
  expect(nativeAdUnit()).toBeNull();
  render(
    <>
      <BillingScreen />
      <NativeAdCard slot={0} />
    </>,
  );
  expect(screen.toJSON()).toBeNull();
});
it('hides billing and store subscription guidance in signed-in account settings', () => {
  render(<AccountSettingsScreen />);
  expect(screen.queryByTestId('account-billing')).toBeNull();
  expect(screen.queryByTestId('account-store-subscriptions')).toBeNull();
  expect(screen.getByTestId('account-delete-text')).toBeTruthy();
});
