import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NativeAd } from 'react-native-google-mobile-ads';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { BillingScreen } from '../components/billing-screen';
import { NativeAdCard } from '../components/native-ad-card';
import { useBilling } from '../lib/monetization/billing';
import { useConsent } from '../lib/monetization/consent';
import { freeAccess } from '../lib/monetization/model';
import { usePreferences } from '../lib/preferences';
import { useNetworkDiagnostic } from '../lib/network';
import { useAccount } from '../lib/account/controller';
import { type Profile } from '../lib/data/models';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('../lib/account/controller', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  return { useAccount: create(() => ({ session: null })), accountSession: { request: jest.fn() } };
});
let mockProfiles: { data: Profile | null }[] = [];
let mockBlocked = false;
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    profiles: mockProfiles,
    settings: { ageBlocked: mockBlocked },
    loading: false,
    error: false,
  }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  useAccount.setState({ session: null });
  usePreferences.setState({ locale: 'en', theme: 'auto' });
  useNetworkDiagnostic.setState({ offline: false });
  useBilling.setState({
    userId: null,
    status: 'ready',
    access: freeAccess,
    products: [],
    busy: false,
    configured: false,
    diagnostic: false,
    syncPending: false,
    message: null,
  });
  useConsent.setState({
    age: 'unknown',
    status: 'ready',
    nonPersonalized: true,
    privacyRequired: false,
  });
  mockProfiles = [];
  mockBlocked = false;
});
it.each(['zh', 'en', 'zh-TW'] as const)(
  'guest paywall has localized store-free sign-in, privacy and terms in %s',
  (locale) => {
    usePreferences.setState({ locale });
    render(<BillingScreen />);
    expect(screen.getByTestId('billing-plan')).toBeTruthy();
    expect(screen.queryByTestId('billing-restore')).toBeNull();
    fireEvent.press(screen.getByTestId('billing-login'));
    expect(mockPush).toHaveBeenCalledWith('/auth/login');
    expect(screen.getByTestId('billing-privacy')).toBeTruthy();
  },
);
it('offline paywall disables cloud operations while retaining verified membership', () => {
  useNetworkDiagnostic.setState({ offline: true });
  useAccount.setState({
    session: { userId: 'alice' } as NonNullable<ReturnType<typeof useAccount.getState>['session']>,
  });
  useBilling.setState({
    userId: 'alice',
    configured: true,
    products: [
      { id: 'tianji_pro_monthly', price: '$2.99' },
      { id: 'tianji_pro_lifetime', price: '$6.99' },
    ],
    access: { pro: true, lifetime: false, until: null, renews: true },
  });
  render(<BillingScreen />);
  expect(screen.getByTestId('billing-offline')).toBeTruthy();
  for (const id of [
    'buy-tianji_pro_monthly',
    'buy-tianji_pro_lifetime',
    'billing-restore',
    'billing-refresh',
    'billing-manage',
  ])
    expect(screen.getByTestId(id)).toBeDisabled();
});
it('lifetime members can still cancel an existing monthly renewal in system management', () => {
  useAccount.setState({
    session: { userId: 'alice' } as NonNullable<ReturnType<typeof useAccount.getState>['session']>,
  });
  useBilling.setState({
    userId: 'alice',
    configured: true,
    access: { pro: true, lifetime: true, until: null, renews: false },
  });
  render(<BillingScreen />);
  expect(screen.getByTestId('billing-manage')).toBeTruthy();
  expect(screen.getByTestId('buy-tianji_pro_monthly')).toBeDisabled();
  expect(screen.getByTestId('buy-tianji_pro_lifetime')).toBeDisabled();
});
it('test native creative loads without personal targeting; upgrading destroys and hides it immediately', async () => {
  render(<NativeAdCard slot={0} />);
  await waitFor(() => expect(screen.getByTestId('native-ad-0')).toBeTruthy());
  expect(NativeAd.createForAdRequest).toHaveBeenLastCalledWith('test-native', {
    requestNonPersonalizedAdsOnly: true,
  });
  const value = (await jest.mocked(NativeAd.createForAdRequest).mock.results[0]?.value) as NativeAd;
  act(() =>
    useBilling.setState({ access: { pro: true, lifetime: true, until: null, renews: false } }),
  );
  expect(screen.queryByTestId('native-ad-0')).toBeNull();
  expect(value.destroy).toHaveBeenCalledTimes(1);
});
it('age, consent mismatch, consent failure and unknown entitlement never issue an ad request', () => {
  mockBlocked = true;
  const view = render(<NativeAdCard slot={0} />);
  expect(NativeAd.createForAdRequest).not.toHaveBeenCalled();
  mockBlocked = false;
  act(() => useConsent.setState({ status: 'error' }));
  view.rerender(<NativeAdCard slot={0} />);
  act(() => useConsent.setState({ status: 'ready', age: 'adult' }));
  view.rerender(<NativeAdCard slot={0} />);
  act(() => {
    useConsent.setState({ age: 'unknown' });
    useBilling.setState({ status: 'error' });
  });
  view.rerender(<NativeAdCard slot={0} />);
  expect(NativeAd.createForAdRequest).not.toHaveBeenCalled();
});
it('13–17 requests are non-personalized and replacing consent destroys the loaded inventory', async () => {
  mockProfiles = [
    {
      data: {
        name: '',
        relation: 'self',
        birth: BirthInputSchema.parse({ ...A, year: new Date().getUTCFullYear() - 15 }),
        version: 1,
        isCurrent: true,
      },
    },
  ];
  useConsent.setState({ age: 'teen', nonPersonalized: false });
  render(<NativeAdCard slot={1} />);
  await waitFor(() => expect(screen.getByTestId('native-ad-1')).toBeTruthy());
  expect(NativeAd.createForAdRequest).toHaveBeenLastCalledWith('test-native', {
    requestNonPersonalizedAdsOnly: true,
  });
  const value = (await jest.mocked(NativeAd.createForAdRequest).mock.results[0]?.value) as NativeAd;
  act(() => useConsent.setState({ status: 'loading' }));
  expect(screen.queryByTestId('native-ad-1')).toBeNull();
  expect(value.destroy).toHaveBeenCalledTimes(1);
});
it('late ad loads destroy themselves after paywall entitlement removes the container', async () => {
  let finish: ((value: NativeAd) => void) | undefined;
  jest.mocked(NativeAd.createForAdRequest).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const destroy = jest.fn();
  render(<NativeAdCard slot={0} />);
  act(() =>
    useBilling.setState({ access: { pro: true, lifetime: true, until: null, renews: false } }),
  );
  await act(async () => {
    finish?.({ headline: 'Test', destroy } as unknown as NativeAd);
  });
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('native-ad-0')).toBeNull();
});
