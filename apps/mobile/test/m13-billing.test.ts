import { createBillingMock } from '../lib/monetization/mock';
import {
  billingAction,
  configureBillingDiagnostic,
  identifyBilling,
  refreshBilling,
  expireBilling,
  useBilling,
} from '../lib/monetization/billing';
import { freeAccess, type Access } from '../lib/monetization/model';
jest.mock('../lib/account/controller', () => ({
  accountSession: { request: jest.fn() },
  useAccount: { getState: () => ({ mock: true }) },
}));
let fixture: ReturnType<typeof createBillingMock>;
beforeEach(async () => {
  await identifyBilling(null);
  fixture = createBillingMock();
  await configureBillingDiagnostic(fixture.provider, fixture.sync);
  await identifyBilling('web-user-id');
});
it('buys exact monthly/lifetime products, restores and opens system management', async () => {
  expect(useBilling.getState().products.map((p) => p.id)).toEqual([
    'tianji_pro_monthly',
    'tianji_pro_lifetime',
  ]);
  const manage = jest.spyOn(fixture.provider, 'manage');
  await billingAction('tianji_pro_monthly');
  expect(useBilling.getState().access).toMatchObject({ pro: true, lifetime: false, renews: true });
  await billingAction('manage');
  expect(manage).toHaveBeenCalledTimes(1);
  await billingAction('tianji_pro_lifetime');
  fixture.clearDevice();
  await billingAction('restore');
  expect(useBilling.getState().access).toMatchObject({ pro: true, lifetime: true });
  expect(useBilling.getState().message).toBe('mobile.billing.restored');
});
it('keeps verified native access when cross-platform sync fails and retries later', async () => {
  fixture.syncError(true);
  await billingAction('tianji_pro_monthly');
  expect(useBilling.getState()).toMatchObject({ syncPending: true, access: { pro: true } });
  fixture.syncError(false);
  await refreshBilling();
  expect(useBilling.getState().syncPending).toBe(false);
});
it('keeps sync pending after HTTP success until the server confirms the purchased lifetime tier', async () => {
  let phase: 'free' | 'monthly' | 'lifetime' = 'free';
  await configureBillingDiagnostic(fixture.provider, async () => {
    const actual = await fixture.sync();
    return phase === 'lifetime'
      ? actual
      : {
          ...actual,
          plan: phase === 'free' ? ('free' as const) : ('pro' as const),
          lifetime: false,
          revenuecatProUntil:
            phase === 'monthly' ? new Date(Date.now() + 86400000).toISOString() : null,
        };
  });
  await billingAction('tianji_pro_lifetime');
  expect(useBilling.getState()).toMatchObject({
    syncPending: true,
    access: { pro: true, lifetime: true },
  });
  phase = 'monthly';
  await refreshBilling();
  expect(useBilling.getState().syncPending).toBe(true);
  phase = 'lifetime';
  await refreshBilling();
  expect(useBilling.getState().syncPending).toBe(false);
});
it('handles cancellation, payment failure and empty restore without granting membership', async () => {
  fixture.fail('cancel');
  await billingAction('tianji_pro_monthly');
  expect(useBilling.getState()).toMatchObject({
    message: 'mobile.billing.cancelled',
    access: freeAccess,
    busy: false,
  });
  fixture.fail('error');
  await billingAction('tianji_pro_lifetime');
  expect(useBilling.getState()).toMatchObject({
    message: 'mobile.billing.error',
    access: freeAccess,
    busy: false,
  });
  await billingAction('restore');
  expect(useBilling.getState().message).toBe('mobile.billing.emptyRestore');
});
it('refreshes refund/revocation events and removes paid rights on logout', async () => {
  await billingAction('tianji_pro_lifetime');
  fixture.revoke();
  await refreshBilling();
  expect(useBilling.getState().access).toEqual(freeAccess);
  await billingAction('tianji_pro_monthly');
  const purchase = jest.spyOn(fixture.provider, 'purchase');
  await identifyBilling(null);
  await billingAction('tianji_pro_lifetime');
  expect(useBilling.getState()).toMatchObject({ userId: null, access: freeAccess });
  expect(purchase).not.toHaveBeenCalled();
});
it('expires offline monthly rights while retaining lifetime and freshly verified grace', async () => {
  const grace: Access = {
    pro: true,
    lifetime: false,
    until: new Date(Date.now() - 1000).toISOString(),
    renews: false,
  };
  jest.spyOn(fixture.provider, 'refresh').mockResolvedValue(grace);
  await refreshBilling();
  expireBilling();
  expect(useBilling.getState().access.pro).toBe(true);
  expireBilling(Date.now() + 300001);
  expect(useBilling.getState().access.pro).toBe(false);
  await billingAction('tianji_pro_lifetime');
  expireBilling(Date.now() + 1e12);
  expect(useBilling.getState().access.lifetime).toBe(true);
});
it('does not extend grace when offline refresh returns an old SDK cache', async () => {
  const cached: Access = {
    pro: true,
    lifetime: false,
    until: new Date(Date.now() - 1000).toISOString(),
    renews: false,
    verifiedAt: Date.now() - 600000,
  };
  jest.spyOn(fixture.provider, 'refresh').mockResolvedValue(cached);
  await refreshBilling();
  expect(useBilling.getState().access.pro).toBe(false);
});
it('ignores delayed purchases and old listener events after switching accounts', async () => {
  let finish: ((value: Access) => void) | undefined;
  const purchase = jest.spyOn(fixture.provider, 'purchase').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = billingAction('tianji_pro_monthly');
  await Promise.resolve();
  expect(purchase).toHaveBeenCalledTimes(1);
  const second = identifyBilling('second-user');
  expect(useBilling.getState()).toMatchObject({
    userId: 'second-user',
    access: freeAccess,
    status: 'loading',
  });
  fixture.revoke();
  finish?.({ pro: true, lifetime: true, until: null, renews: false });
  await first;
  await second;
  expect(useBilling.getState()).toMatchObject({ userId: 'second-user', access: freeAccess });
});
it('does not start duplicate store transactions', async () => {
  const purchase = jest.spyOn(fixture.provider, 'purchase');
  await Promise.all([billingAction('tianji_pro_monthly'), billingAction('tianji_pro_monthly')]);
  expect(purchase).toHaveBeenCalledTimes(1);
});
it('rejects another account server response and preserves native verified results', async () => {
  await configureBillingDiagnostic(fixture.provider, async () => ({
    userId: 'other',
    plan: 'pro',
    lifetime: true,
    revenuecatProUntil: null,
  }));
  await refreshBilling();
  expect(useBilling.getState()).toMatchObject({ syncPending: true, access: freeAccess });
});

it('failed identity binding keeps restoring unavailable until an explicit refresh succeeds', async () => {
  const identify = jest
    .spyOn(fixture.provider, 'identify')
    .mockRejectedValueOnce(new Error('offline'));
  await identifyBilling('retry-user');
  expect(useBilling.getState().configured).toBe(false);
  await refreshBilling();
  expect(identify).toHaveBeenLastCalledWith('retry-user');
  expect(useBilling.getState().configured).toBe(true);
});
