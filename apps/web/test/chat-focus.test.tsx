// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { ChatPanel } from '../components/report/chat-panel';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import tw from '../messages/zh-TW.json';

vi.mock('../i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
}));
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  // Model a frame running before React commits the queued enabled state.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  vi.unstubAllGlobals();
});

async function conversation(locale: 'zh' | 'en' | 'zh-TW', remaining = 3) {
  const catalog = { zh, en, 'zh-TW': tw }[locale];
  let complete: (response: Response) => void = () => {};
  const pending = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (_input, options) =>
      options?.method === 'POST'
        ? pending
        : Response.json({
            ok: true,
            data: { available: true, remaining, limit: 3, messages: [] },
          }),
    ),
  );
  render(
    <NextIntlClientProvider locale={locale} messages={toMessages(catalog)} timeZone="UTC">
      <ChatPanel readingId="fixture" system="bazi" owner fullScreen />
      <button>Outside</button>
    </NextIntlClientProvider>,
  );
  const composer = await screen.findByRole('textbox', { name: catalog['report.chat.question'] });
  fireEvent.change(composer, { target: { value: 'A question' } });
  const send = screen.getByRole('button', { name: catalog['report.chat.send'] });
  send.focus();
  fireEvent.click(send);
  await waitFor(() => expect(composer.hasAttribute('disabled')).toBe(true));
  const finish = async () => {
    await act(async () => {
      complete(new Response('{"type":"delta","text":"Reflection"}\n{"type":"done"}\n'));
    });
    await waitFor(() => expect((composer as HTMLTextAreaElement).value).toBe(''));
  };
  return { composer, finish };
}

it.each(['zh', 'en', 'zh-TW'] as const)(
  '%s restores keyboard focus after the composer is enabled, even when frames run early',
  async (locale) => {
    const { composer, finish } = await conversation(locale);
    await finish();
    expect(composer.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(composer);
  },
);
it('preserves focus deliberately moved outside the composer during streaming', async () => {
  const { finish } = await conversation('en');
  const outside = screen.getByRole('button', { name: 'Outside' });
  outside.focus();
  await finish();
  expect(document.activeElement).toBe(outside);
});
it('does not focus a disabled composer when the final quota is consumed', async () => {
  const { composer, finish } = await conversation('en', 1);
  await finish();
  expect(composer.hasAttribute('disabled')).toBe(true);
  expect(document.activeElement).not.toBe(composer);
});
