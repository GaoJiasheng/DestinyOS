// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
const server = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }));
vi.mock('../app/readings/actions', () => ({
  listReadingsAction: server.list,
  deleteReadingAction: server.remove,
}));
vi.mock('../i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    disconnect() {}
  },
);
const { HistoryList } = await import('../components/report/history-list');
const item = {
  id: 'r1',
  system: 'bazi',
  title: null,
  createdAt: '2026-11-01T00:00:00Z',
  keywords: [],
};
afterEach(cleanup);
beforeEach(() => server.list.mockReset());
describe('owner history filters', () => {
  it('explains an empty filtered result and clears the filters', async () => {
    server.list.mockResolvedValueOnce({ ok: true, data: { items: [], nextCursor: null } });
    server.list.mockResolvedValueOnce({ ok: true, data: { items: [item], nextCursor: null } });
    render(
      <NextIntlClientProvider locale="zh" messages={toMessages(zh)} timeZone="UTC">
        {/* @ts-expect-error The fixture carries only the fields the list renders. */}
        <HistoryList initial={{ items: [item], nextCursor: null }} />
      </NextIntlClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(zh['me.history.search']), {
      target: { value: 'nothing' },
    });
    fireEvent.submit(screen.getByLabelText(zh['me.history.search']).closest('form')!);
    await screen.findByText(zh['report.history.noMatch']);
    expect(screen.queryByText(zh['report.history.empty'], { exact: false })).toBeNull();
    expect(server.list).toHaveBeenLastCalledWith({ limit: 20, search: 'nothing' });
    const clear = screen.getByRole('button', { name: zh['report.history.clearFilters'] });
    await waitFor(() => expect((clear as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(clear);
    await waitFor(() => expect(server.list).toHaveBeenLastCalledWith({ limit: 20 }));
    await waitFor(() => expect(screen.queryByText(zh['report.history.noMatch'])).toBeNull());
    expect((screen.getByLabelText(zh['me.history.search']) as HTMLInputElement).value).toBe('');
  });
});
