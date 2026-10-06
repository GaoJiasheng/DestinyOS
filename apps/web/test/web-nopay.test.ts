import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  stripe: vi.fn(),
  auth: vi.fn(),
  sync: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('../lib/stripe', () => {
  mocks.stripe();
  throw new Error('Disabled Stripe was loaded');
});
vi.mock('../lib/auth', () => ({ auth: mocks.auth }));
vi.mock('../lib/revenuecat', () => ({ refreshRevenuecat: mocks.sync }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { POST } from '../app/api/v1/stripe/webhook/route';
import { createCheckoutSessionAction, createPortalSessionAction } from '../app/billing/actions';
import { refreshMembershipAction } from '../app/billing/membership-actions';
import { webPaymentsEnabled, billingEnabled } from '../lib/web-payments';
import { appStoreUrl, mobileStore } from '../lib/app-stores';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it('is off by default even with configured Stripe credentials, and returns 404 without loading Stripe', async () => {
  vi.stubEnv('FEATURE_WEB_PAYMENTS', '');
  vi.stubEnv('STRIPE_SECRET_KEY', 'test');
  expect(webPaymentsEnabled()).toBe(false);
  expect(billingEnabled()).toBe(false);
  expect(
    (await POST(new Request('https://example.test/api/v1/stripe/webhook', { method: 'POST' })))
      .status,
  ).toBe(404);
  expect(await createCheckoutSessionAction({ price: 'monthly' })).toMatchObject({
    ok: false,
    error: { code: 'E_NOT_FOUND' },
  });
  expect(await createPortalSessionAction()).toMatchObject({
    ok: false,
    error: { code: 'E_NOT_FOUND' },
  });
  expect(mocks.stripe).not.toHaveBeenCalled();
  expect(mocks.auth).not.toHaveBeenCalled();
});
it('refreshes only the session identity and handles missing provider configuration', async () => {
  mocks.auth.mockResolvedValue(null);
  expect(await refreshMembershipAction()).toEqual({ result: 'error' });
  expect(mocks.sync).not.toHaveBeenCalled();
  mocks.auth.mockResolvedValue({ user: { id: 'owner' } });
  mocks.sync.mockResolvedValue(false);
  expect(await refreshMembershipAction()).toEqual({ result: 'skipped' });
  expect(mocks.revalidate).not.toHaveBeenCalled();
  mocks.sync.mockResolvedValue(true);
  expect(await refreshMembershipAction()).toEqual({ result: 'refreshed' });
  expect(mocks.sync).toHaveBeenLastCalledWith('owner');
});
it('selects mobile stores and validates missing or unsafe store URLs', () => {
  expect(mobileStore('Android', 1)).toBe('google');
  expect(mobileStore('iPhone', 1)).toBe('apple');
  expect(mobileStore('Macintosh', 5)).toBe('apple');
  expect(mobileStore('Macintosh', 0)).toBeNull();
  expect(appStoreUrl('')).toBeNull();
  expect(appStoreUrl('javascript:alert(1)')).toBeNull();
  expect(appStoreUrl('https://apps.apple.com/app/test')).toBe('https://apps.apple.com/app/test');
});
