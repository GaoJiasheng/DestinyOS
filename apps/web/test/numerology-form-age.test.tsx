// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import type { AnonymousData } from '../lib/anonymous-storage';
const updates: AnonymousData[] = [];
const empty = { anonId: 'a', readings: [], settings: {} } as unknown as AnonymousData;
vi.mock('../lib/anonymous-storage', () => ({
  readAnonymous: vi.fn(async () => null),
  updateAnonymous: vi.fn(async (change: (data: AnonymousData) => AnonymousData) => {
    const next = change(empty);
    updates.push(next);
    return next;
  }),
}));
vi.mock('../app/readings/actions', () => ({
  createReadingAction: vi.fn(async () => ({ ok: true, data: { report: {} } })),
  blockAgeAction: vi.fn(async () => undefined),
}));
vi.mock('../lib/consent', () => ({ afterConsent: (proceed: () => void) => proceed() }));
const push = vi.fn();
vi.mock('../i18n/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
const { NumerologyForm } = await import('../components/forms/numerology-form');
const { createReadingAction, blockAgeAction } = await import('../app/readings/actions');
afterEach(() => {
  cleanup();
  updates.length = 0;
  vi.clearAllMocks();
});
const fill = async () => {
  render(
    <NextIntlClientProvider locale="zh" messages={toMessages(zh)} timeZone="UTC">
      <NumerologyForm signedIn={false} />
    </NextIntlClientProvider>,
  );
  const year = await screen.findByLabelText(zh['form.birth.year']);
  await vi.waitFor(() =>
    expect((year as HTMLInputElement).closest('fieldset')?.disabled).toBe(false),
  );
  fireEvent.change(year, { target: { value: '2020' } });
  fireEvent.change(screen.getByLabelText(zh['form.birth.month']), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText(zh['form.birth.day']), { target: { value: '15' } });
  fireEvent.click(screen.getByRole('button', { name: zh['form.birth.submit'] }));
};
it('continues an under-13 date as someone else and keeps it off the device profile', async () => {
  await fill();
  fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.ageCheck.other'] }));
  await vi.waitFor(() => expect(push).toHaveBeenCalled());
  expect(vi.mocked(createReadingAction).mock.calls[0]![0]).toMatchObject({ subject: 'other' });
  expect(blockAgeAction).not.toHaveBeenCalled();
  expect(updates[0]!.profile).toBeUndefined();
  expect(updates[0]!.readings[0]!.request).toMatchObject({ subject: 'other' });
});
it('locks when the user says the under-13 date is their own', async () => {
  await fill();
  fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.ageCheck.self'] }));
  expect(blockAgeAction).toHaveBeenCalledOnce();
  expect(createReadingAction).not.toHaveBeenCalled();
});
