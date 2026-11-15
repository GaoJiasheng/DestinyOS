// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { ChatPanel } from '../components/report/chat-panel';
import { toMessages } from '../i18n/catalog';
import en from '../messages/en.json';

vi.mock('../i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
}));
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  vi.unstubAllGlobals();
});

type Post = (init: RequestInit) => Promise<Response>;
async function mount(post: Post, messages: { id: string; role: string; content: string }[] = []) {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) =>
    init?.method === 'POST'
      ? post(init)
      : init?.method === 'DELETE'
        ? Response.json({ ok: true })
        : Response.json({
            ok: true,
            data: {
              available: true,
              remaining: 3,
              limit: 3,
              messages: messages.map((m) => ({ ...m, createdAt: '2026-01-01T00:00:00Z' })),
            },
          }),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)} timeZone="UTC">
      <ChatPanel readingId="fixture" system="bazi" owner fullScreen />
    </NextIntlClientProvider>,
  );
  const composer = await screen.findByRole('textbox', { name: en['report.chat.question'] });
  fireEvent.change(composer, { target: { value: 'A question' } });
  const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length;
  return { composer, posts };
}
const done = () => new Response('{"type":"delta","text":"Reply"}\n{"type":"done"}\n');

it('sends on Enter, but not on Shift+Enter or while an IME is composing', async () => {
  const { composer, posts } = await mount(async () => done());
  fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true });
  fireEvent.keyDown(composer, { key: 'Enter', isComposing: true });
  fireEvent.keyDown(composer, { key: 'Enter', keyCode: 229 });
  expect(posts()).toBe(0);
  fireEvent.keyDown(composer, { key: 'Enter' });
  await waitFor(() => expect(posts()).toBe(1));
  expect(await screen.findByText('Reply')).toBeTruthy();
});

it('stops a streaming answer and keeps the part already written', async () => {
  const encoder = new TextEncoder();
  const { composer } = await mount(
    async (init) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('{"type":"delta","text":"Partial"}\n'));
            init.signal?.addEventListener('abort', () =>
              controller.error(new DOMException('Aborted', 'AbortError')),
            );
          },
        }),
      ),
  );
  fireEvent.keyDown(composer, { key: 'Enter' });
  await waitFor(() => expect(composer.hasAttribute('disabled')).toBe(true));
  const stop = await screen.findByRole('button', { name: en['report.chat.stop'] });
  await screen.findByText('Partial');
  await act(async () => {
    fireEvent.click(stop);
  });
  expect(await screen.findByText(en['report.chat.stopped'])).toBeTruthy();
  expect(screen.getByText('Partial')).toBeTruthy();
  expect(screen.getByText('A question')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('asks for confirmation before deleting the whole conversation', async () => {
  await mount(
    async () => done(),
    [
      { id: '1', role: 'user', content: 'Earlier question' },
      { id: '2', role: 'assistant', content: 'Earlier answer' },
    ],
  );
  fireEvent.click(screen.getByRole('button', { name: en['report.chat.delete'] }));
  expect(screen.getByText(en['report.chat.deleteConfirm'])).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: en['report.cancel'] }));
  expect(screen.getByText('Earlier question')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: en['report.chat.delete'] }));
  fireEvent.click(screen.getByRole('button', { name: en['report.confirm'] }));
  await waitFor(() => expect(screen.queryByText('Earlier question')).toBeNull());
});
