// @vitest-environment jsdom
import { useEffect } from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { toMessages } from '../i18n/catalog';
import en from '../messages/en.json';
const mock = vi.hoisted(() => ({
  policy: vi.fn(),
  anonymous: vi.fn(),
  path: '/en',
  record: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => mock.path }));
vi.mock('../app/ads/actions', () => ({
  getAdPolicyAction: mock.policy,
  recordAdImpressionAction: mock.record,
}));
vi.mock('../lib/anonymous-storage', () => ({ readAnonymous: mock.anonymous }));
vi.mock('next/script', () => ({
  default: function TestScript({ src, onReady }: { src: string; onReady: () => void }) {
    useEffect(() => {
      onReady();
    }, [onReady]);
    return <span data-script={src} />;
  },
}));
import { AdsProvider } from '../components/ads/ads-provider';
import { AdSlot } from '../components/ads/ad-slot';
beforeEach(() => {
  vi.clearAllMocks();
  mock.path = '/en';
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-test');
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT_HOME', '1234');
  mock.policy.mockResolvedValue({ enabled: true, plan: 'free', underAge: false, blocked: false });
  mock.anonymous.mockResolvedValue(null);
  delete window.adsbygoogle;
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
function show() {
  return render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)}>
      <AdsProvider>
        <AdSlot slot="home" />
      </AdsProvider>
    </NextIntlClientProvider>,
  );
}
it('injects only for eligible free visitors and pushes each fixed slot once', async () => {
  const view = show();
  await waitFor(() =>
    expect(view.container.querySelector('ins')?.getAttribute('data-ad-slot')).toBe('1234'),
  );
  expect(view.container.querySelector('[data-script]')?.getAttribute('data-script')).toContain(
    'ca-pub-test',
  );
  await waitFor(() => expect(window.adsbygoogle?.length).toBe(1));
  expect(window.adsbygoogle?.requestNonPersonalizedAds).toBe(1);
  const slot = view.container.querySelector('ins');
  slot?.setAttribute('data-ad-status', 'filled');
  await waitFor(() => expect(mock.record).toHaveBeenCalledWith('home'));
});
it('sets minor flags before requesting ads', async () => {
  mock.policy.mockResolvedValue({ enabled: true, plan: 'free', underAge: true, blocked: false });
  const view = show();
  await waitFor(() => expect(view.container.querySelector('ins')).not.toBeNull());
  expect(window.adsbygoogle?.requestNonPersonalizedAds).toBe(1);
  expect(window.adsbygoogle?.tagForUnderAgeOfConsent).toBe(1);
});
it('omits scripts, slots and ad tags for Pro and known under-13 visitors', async () => {
  for (const policy of [
    { enabled: false, plan: 'pro', underAge: false, blocked: false },
    { enabled: false, plan: 'free', underAge: false, blocked: true },
  ]) {
    mock.policy.mockResolvedValue(policy);
    const view = show();
    await waitFor(() => expect(mock.anonymous).toHaveBeenCalled());
    expect(view.container.querySelector('ins')).toBeNull();
    expect(view.container.querySelector('[data-script]')).toBeNull();
    expect(window.adsbygoogle).toBeUndefined();
    cleanup();
    vi.clearAllMocks();
  }
});
it('never requests eligibility or injects an ad script on excluded routes or without a client', async () => {
  mock.path = '/en/me/birth';
  const first = show();
  expect(mock.policy).not.toHaveBeenCalled();
  expect(first.container.querySelector('ins')).toBeNull();
  cleanup();
  mock.path = '/en';
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', '');
  const second = show();
  expect(mock.policy).not.toHaveBeenCalled();
  expect(second.container.querySelector('[data-script]')).toBeNull();
});
