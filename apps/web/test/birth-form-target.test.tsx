// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { BirthInput } from '@tianji/shared';
import { BirthForm } from '../components/forms/birth-form';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import type { AnonymousData } from '../lib/anonymous-storage';
const profile: BirthInput = {
  calendar: 'gregorian',
  year: 1985,
  month: 3,
  day: 9,
  hour: 7,
  minute: 0,
  timeUnknown: false,
  gender: 'female',
};
const stored: AnonymousData = {
  anonId: 'a',
  profile,
  displayName: 'Me',
  readings: [],
  settings: {},
} as unknown as AnonymousData;
const updates: AnonymousData[] = [];
vi.mock('../lib/anonymous-storage', () => ({
  readAnonymous: vi.fn(async () => stored),
  updateAnonymous: vi.fn(async (change: (data: AnonymousData) => AnonymousData) => {
    const next = change(stored);
    updates.push(next);
    return next;
  }),
}));
vi.mock('../app/readings/actions', () => ({
  createReadingAction: vi.fn(async () => ({ ok: true, data: { report: {} } })),
  upsertProfileAction: vi.fn(),
  blockAgeAction: vi.fn(),
}));
vi.mock('../lib/consent', () => ({ afterConsent: (proceed: () => void) => proceed() }));
const push = vi.fn();
vi.mock('../i18n/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
afterEach(() => {
  cleanup();
  updates.length = 0;
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});
const show = () =>
  render(
    <NextIntlClientProvider locale="zh" messages={toMessages(zh)} timeZone="UTC">
      <BirthForm />
    </NextIntlClientProvider>,
  );
describe('guest with a device profile', () => {
  it('defaults to someone else, starts blank and leaves the profile untouched', async () => {
    show();
    const other = (await screen.findByLabelText(zh['form.birth.for.other'])) as HTMLInputElement;
    expect(other.checked).toBe(true);
    expect((screen.getByLabelText(zh['form.birth.year']) as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText(zh['form.birth.year']), { target: { value: '1990' } });
    fireEvent.change(screen.getByLabelText(zh['form.birth.month']), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(zh['form.birth.day']), { target: { value: '15' } });
    fireEvent.click(screen.getByLabelText(zh['form.birth.timeUnknown']));
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.submit'] }));
    await vi.waitFor(() => expect(push).toHaveBeenCalled(), { timeout: 3000 });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.profile).toEqual(profile);
    expect(updates[0]!.readings).toHaveLength(1);
    expect(sessionStorage.getItem('tianji.draft.bazi')).toBeNull();
  });
  it('charts an under-13 birthday marked as someone else without asking or touching the profile', async () => {
    const { createReadingAction, blockAgeAction } = await import('../app/readings/actions');
    vi.mocked(createReadingAction).mockClear();
    push.mockClear();
    show();
    await screen.findByLabelText(zh['form.birth.for.other']);
    fireEvent.change(screen.getByLabelText(zh['form.birth.year']), { target: { value: '2020' } });
    fireEvent.change(screen.getByLabelText(zh['form.birth.month']), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(zh['form.birth.day']), { target: { value: '15' } });
    fireEvent.click(screen.getByLabelText(zh['form.birth.timeUnknown']));
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.submit'] }));
    await vi.waitFor(() => expect(push).toHaveBeenCalled(), { timeout: 3000 });
    expect(blockAgeAction).not.toHaveBeenCalled();
    expect(vi.mocked(createReadingAction).mock.calls[0]![0]).toMatchObject({ subject: 'other' });
    expect(updates[0]!.profile).toEqual(profile);
    expect(updates[0]!.readings[0]!.request).toMatchObject({ subject: 'other' });
  });
  it('fills the saved profile when the user picks themselves', async () => {
    show();
    fireEvent.click(await screen.findByLabelText(zh['form.birth.for.self']));
    expect((screen.getByLabelText(zh['form.birth.year']) as HTMLInputElement).value).toBe('1985');
  });
});
