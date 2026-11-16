// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { startTransition, useActionState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginState } from '../app/[locale]/auth/actions';
import type { CodeState } from '../app/[locale]/auth/code-actions';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
const server = vi.hoisted(() => ({
  send: vi.fn<(_previous: LoginState, form: FormData) => Promise<LoginState>>(),
}));
vi.mock('../app/[locale]/auth/actions', () => ({ loginFormAction: server.send }));
const codeServer = vi.hoisted(() => ({
  verify: vi.fn<(locale: string, email: string, code: string) => Promise<CodeState>>(),
}));
vi.mock('../app/[locale]/auth/code-actions', () => ({
  verifyLoginCodeAction: codeServer.verify,
  loginCodeFormAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('callbackUrl=%2Fzh%2Fme%2Fprofiles'),
}));
import { LoginForm } from '../components/forms/login-form';
afterEach(cleanup);
beforeEach(() => {
  server.send.mockReset();
  codeServer.verify.mockReset();
});
// The code form adds a second button once a link is sent; target the email form's own button.
const sendButton = (email: HTMLInputElement) =>
  email.form!.querySelector('button[type="submit"]') as HTMLButtonElement;
for (const [locale, copy] of [
  ['zh', zh],
  ['en', en],
] as const) {
  describe(`email login ${locale}`, () => {
    const show = (background?: ReactNode) =>
      render(
        <NextIntlClientProvider locale={locale} messages={toMessages(copy)} timeZone="UTC">
          {background}
          <LoginForm locale={locale} />
        </NextIntlClientProvider>,
      );
    it('blocks duplicate submits while sending and restores the translated success state', async () => {
      let resolve: (state: LoginState) => void = () => {};
      server.send.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const page = show();
      const email = page.getByLabelText(copy['auth.login.email']) as HTMLInputElement;
      fireEvent.change(email, { target: { value: 'person@example.test' } });
      const form = email.form!;
      fireEvent.submit(form);
      fireEvent.submit(form);
      expect(server.send).toHaveBeenCalledTimes(1);
      expect(server.send.mock.calls[0]?.[1].get('locale')).toBe(locale);
      expect(server.send.mock.calls[0]?.[1].get('email')).toBe('person@example.test');
      expect(server.send.mock.calls[0]?.[1].get('callbackUrl')).toBe('/zh/me/profiles');
      expect(email.disabled).toBe(true);
      expect(sendButton(email).disabled).toBe(true);
      await act(async () => resolve({ ok: true, email: 'person@example.test' }));
      await waitFor(() =>
        expect(page.getByRole('status').textContent).toContain('person@example.test'),
      );
      expect(email.disabled).toBe(false);
      // A successful send starts the resend cooldown.
      expect(sendButton(email).disabled).toBe(true);
      expect(sendButton(email).textContent).toContain('60');
    });
    it('counts down for 60 seconds before another link can be sent', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        server.send.mockResolvedValue({ ok: true, email: 'person@example.test' });
        const page = show();
        const email = page.getByLabelText(copy['auth.login.email']) as HTMLInputElement;
        fireEvent.change(email, { target: { value: 'person@example.test' } });
        fireEvent.submit(email.form!);
        await waitFor(() => expect(sendButton(email).disabled).toBe(true));
        fireEvent.submit(email.form!);
        expect(server.send).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTime(30_000));
        expect(sendButton(email).textContent).toMatch(/30|29/);
        await act(async () => vi.advanceTimersByTime(31_000));
        const button = sendButton(email);
        expect(button.disabled).toBe(false);
        expect(button.textContent).toBe(copy['auth.login.resend']);
        fireEvent.submit(email.form!);
        await waitFor(() => expect(server.send).toHaveBeenCalledTimes(2));
      } finally {
        vi.useRealTimers();
      }
    });
    it('finishes its own request while an unrelated startup Action remains pending', async () => {
      let finish: () => void = () => {};
      const background = new Promise<void>((resolve) => {
        finish = resolve;
      });
      function BackgroundAction() {
        const [, action] = useActionState(async () => {
          await background;
          return 1;
        }, 0);
        return <button onClick={() => startTransition(() => action())}>Background</button>;
      }
      server.send.mockResolvedValue({ ok: true, email: 'person@example.test' });
      const page = show(<BackgroundAction />);
      fireEvent.click(page.getByRole('button', { name: 'Background' }));
      const email = page.getByLabelText(copy['auth.login.email']) as HTMLInputElement;
      fireEvent.change(email, { target: { value: 'person@example.test' } });
      fireEvent.submit(email.form!);
      try {
        await waitFor(() =>
          expect(page.getByRole('status').textContent).toContain('person@example.test'),
        );
        expect(email.disabled).toBe(false);
        expect(server.send).toHaveBeenCalledTimes(1);
      } finally {
        await act(async () => finish());
      }
    });
    it('restores the form and shows localized feedback after a transport failure', async () => {
      server.send.mockRejectedValue(new Error('Disconnected'));
      const page = show();
      const email = page.getByLabelText(copy['auth.login.email']) as HTMLInputElement;
      fireEvent.change(email, { target: { value: 'person@example.test' } });
      fireEvent.submit(email.form!);
      await waitFor(() =>
        expect(page.getByRole('alert').textContent).toBe(copy['auth.error.internal']),
      );
      expect(email.disabled).toBe(false);
    });
    it('offers a numeric one-time-code field after sending and signs in on this page', async () => {
      server.send.mockResolvedValue({ ok: true, email: 'person@example.test' });
      const assign = vi.fn();
      vi.stubGlobal('location', { ...window.location, assign });
      try {
        const page = show();
        const email = page.getByLabelText(copy['auth.login.email']) as HTMLInputElement;
        fireEvent.change(email, { target: { value: 'person@example.test' } });
        fireEvent.submit(email.form!);
        const code = (await page.findByLabelText(copy['auth.code.label'])) as HTMLInputElement;
        expect(code.inputMode).toBe('numeric');
        expect(code.autocomplete).toBe('one-time-code');
        expect(page.getByRole('status').textContent).toContain(copy['auth.code.sentHint']);
        // Pasted codes keep only their digits.
        fireEvent.change(code, { target: { value: '012 345' } });
        expect(code.value).toBe('012345');
        codeServer.verify.mockResolvedValueOnce({ ok: false, code: 'E_CODE', attemptsLeft: 3 });
        fireEvent.submit(code.form!);
        await waitFor(() =>
          expect(page.getByRole('alert').textContent).toBe(
            locale === 'zh'
              ? '验证码不正确或已过期，还可再试 3 次。'
              : 'That code is incorrect or has expired. 3 tries left.',
          ),
        );
        expect(codeServer.verify).toHaveBeenCalledWith(locale, 'person@example.test', '012345');
        expect(code.getAttribute('aria-invalid')).toBe('true');
        codeServer.verify.mockResolvedValueOnce({ ok: true, target: '/zh/me/profiles' });
        fireEvent.change(code, { target: { value: '654321' } });
        fireEvent.submit(code.form!);
        await waitFor(() => expect(assign).toHaveBeenCalledWith('/zh/me/profiles'));
      } finally {
        vi.unstubAllGlobals();
      }
    });
    it('asks for six digits locally and disables a spent code', async () => {
      server.send.mockResolvedValue({ ok: true, email: 'person@example.test' });
      const page = show();
      const email = page.getByLabelText(copy['auth.login.email']) as HTMLInputElement;
      fireEvent.change(email, { target: { value: 'person@example.test' } });
      fireEvent.submit(email.form!);
      const code = (await page.findByLabelText(copy['auth.code.label'])) as HTMLInputElement;
      fireEvent.change(code, { target: { value: '123' } });
      fireEvent.submit(code.form!);
      await waitFor(() =>
        expect(page.getByRole('alert').textContent).toBe(copy['auth.code.format']),
      );
      expect(codeServer.verify).not.toHaveBeenCalled();
      codeServer.verify.mockResolvedValueOnce({ ok: false, code: 'E_CODE', attemptsLeft: 0 });
      fireEvent.change(code, { target: { value: '123456' } });
      fireEvent.submit(code.form!);
      await waitFor(() =>
        expect(page.getByRole('alert').textContent).toBe(copy['auth.code.exhausted']),
      );
      expect(code.disabled).toBe(true);
    });
    it('explains a rate limit in minutes', async () => {
      const page = show();
      const email = page.getByLabelText(copy['auth.login.email']) as HTMLInputElement;
      fireEvent.change(email, { target: { value: 'person@example.test' } });
      server.send.mockResolvedValueOnce({ ok: false, code: 'E_RATE_LIMITED', retryAfter: 600 });
      fireEvent.submit(email.form!);
      await waitFor(() => expect(page.getByRole('alert').textContent).toMatch(/10/));
      expect(page.getByRole('alert').textContent).not.toMatch(/600/);
    });
  });
}
