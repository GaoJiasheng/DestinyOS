// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { Button } from '../components/ui/button';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
afterEach(cleanup);
for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const) {
  describe(`async button feedback (${locale})`, () => {
    it('shows pending immediately, locks rapid clicks, then allows a new request', async () => {
      let complete: (() => void) | undefined;
      const action = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
      render(
        <NextIntlClientProvider locale={locale} messages={toMessages(catalog)} timeZone="UTC">
          <Button action={action}>{catalog['common.retry']}</Button>
        </NextIntlClientProvider>,
      );
      const button = screen.getByRole('button');
      // Two events in one batch exercise the ref lock before React commits disabled.
      act(() => {
        fireEvent.click(button);
        fireEvent.click(button);
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(button.textContent).toBe(catalog['common.loading']);
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
      await act(async () => {
        complete?.();
      });
      expect(button.textContent).toBe(catalog['common.retry']);
      expect((button as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(button);
      expect(action).toHaveBeenCalledTimes(2);
      await act(async () => {
        complete?.();
      });
    });
  });
}
