// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { afterStream, isStreaming } from '../lib/after-stream';

afterEach(() => {
  document.body.innerHTML = '';
});

/** The markup React streams for a boundary whose content has not arrived yet. */
function pendingBoundary() {
  document.body.innerHTML = '<!--$?--><template id="B:0"></template><p>Loading</p><!--/$-->';
  return document.body.firstChild as Comment;
}

it('runs at once when nothing is streaming', () => {
  const update = vi.fn();
  afterStream(update);
  expect(update).toHaveBeenCalledOnce();
});

it('waits until a pending boundary is revealed', async () => {
  pendingBoundary();
  const update = vi.fn();
  afterStream(update);
  expect(isStreaming()).toBe(true);
  expect(update).not.toHaveBeenCalled();
  document.getElementById('B:0')?.remove();
  await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
});

it('stops waiting when a boundary fails, and can be cancelled', async () => {
  const marker = pendingBoundary();
  const cancelled = vi.fn();
  afterStream(cancelled)();
  const update = vi.fn();
  afterStream(update);
  marker.data = '$!';
  await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
  expect(cancelled).not.toHaveBeenCalled();
});
