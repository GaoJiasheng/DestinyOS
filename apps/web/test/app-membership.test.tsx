// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { toMessages, runtimeKey } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import tw from '../messages/zh-TW.json';
const language = vi.hoisted(() => ({ current: 'zh' }));
vi.mock('../i18n/use-copy', () => ({
  useCopy: () => {
    const t = createTranslator({
      locale: language.current,
      messages: toMessages(language.current === 'en' ? en : language.current === 'zh-TW' ? tw : zh),
    });
    return (key: string, values?: Record<string, string>) => t(runtimeKey(key), values);
  },
}));
vi.mock('../i18n/get-copy', () => ({
  getCopy: async () => (key: keyof typeof zh) =>
    (language.current === 'en' ? en : language.current === 'zh-TW' ? tw : zh)[key],
}));
import { AppMembership } from '../components/billing/app-membership';
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
it.each(['zh', 'zh-TW', 'en'])(
  'renders benefits, prices and coming-soon stores without payment controls in %s',
  async (locale) => {
    language.current = locale;
    vi.stubEnv('NEXT_PUBLIC_APP_STORE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_PLAY_STORE_URL', '');
    const copy = locale === 'en' ? en : locale === 'zh-TW' ? tw : zh;
    render(await AppMembership());
    expect(screen.getByText(copy['billing.appPrice'])).toBeTruthy();
    expect(screen.getByRole('button', { name: copy['billing.openInApp'] })).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy['billing.subscribe'] })).toBeNull();
    expect(screen.getAllByText(new RegExp(copy['billing.storeSoon']))).toHaveLength(2);
  },
);
it('creates local data QR images for each configured store', async () => {
  language.current = 'en';
  vi.stubEnv('NEXT_PUBLIC_APP_STORE_URL', 'https://apps.apple.com/app/test');
  vi.stubEnv('NEXT_PUBLIC_PLAY_STORE_URL', 'https://play.google.com/store/apps/details?id=test');
  render(await AppMembership());
  expect(screen.getByRole('link', { name: en['billing.appStore'] }).getAttribute('href')).toBe(
    'https://apps.apple.com/app/test',
  );
  expect(screen.getAllByRole('img')).toHaveLength(2);
  for (const image of screen.getAllByRole('img'))
    expect(image.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
});
