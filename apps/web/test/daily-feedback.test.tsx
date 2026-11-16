// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { toMessages, runtimeKey } from '../i18n/catalog';
import zh from '../messages/zh.json';
const action = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notify', () => ({ notifySuccess: notify }));
vi.mock('../i18n/use-copy', () => ({
  useCopy: () => {
    const t = createTranslator({ locale: 'zh', messages: toMessages(zh) });
    return (key: string, values?: Record<string, string>) => t(runtimeKey(key), values);
  },
}));
vi.mock('@/app/readings/actions', () => ({ submitFeedbackAction: action }));
import { DailyFeedback } from '../components/daily/daily-feedback';
afterEach(cleanup);

it('keeps a thrown or failed vote inside the card and retries the same vote', async () => {
  const setVote = vi.fn();
  action.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true });
  render(<DailyFeedback vote={null} setVote={setVote} />);
  fireEvent.click(screen.getByRole('button', { name: zh['daily.feedbackNo'] }));
  await screen.findByText(zh['daily.feedbackError'], { exact: false });
  expect(setVote).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: zh['common.retry'] }));
  await waitFor(() => expect(setVote).toHaveBeenCalledWith(-1));
  expect(action).toHaveBeenLastCalledWith({ sectionKey: 'daily', vote: -1 });
  expect(screen.queryByText(zh['daily.feedbackError'], { exact: false })).toBeNull();
  // A saved vote is a transient toast, not a lingering inline status.
  expect(notify).toHaveBeenCalledWith(zh['daily.feedbackSaved']);
  expect(notify).toHaveBeenCalledTimes(1);
});
