// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { printSettled, selectPrintSheet, zoomPrintReport } from '../lib/platform/print-dom';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it('accepts ready/error sentinels and keeps missing or pending print documents unsettled', () => {
  expect(printSettled()).toBe(false);
  const root = document.createElement('div');
  root.className = 'print-report';
  document.body.append(root);
  for (const [sentinel, ready] of [
    ['false', false],
    ['true', true],
    ['error', true],
  ] as const) {
    root.dataset.ready = sentinel;
    expect(printSettled()).toBe(ready);
  }
});

it('waits for the streamed hidden duplicate before accepting a ready document', () => {
  const root = document.createElement('div');
  root.className = 'print-report';
  root.dataset.ready = 'true';
  const hidden = document.createElement('div');
  hidden.hidden = true;
  hidden.append(root.cloneNode(true));
  document.body.append(root, hidden);
  expect(printSettled()).toBe(false);
  hidden.remove();
  expect(printSettled()).toBe(true);
});

it('keeps A4 zoom and zero-based sheet visibility identical for both browser adapters', () => {
  const root = document.createElement('div');
  zoomPrintReport(root);
  expect(root.style.zoom).toBe(String(2480 / ((210 * 96) / 25.4)));
  const nodes = Array.from({ length: 3 }, () => document.createElement('section'));
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  selectPrintSheet(nodes, 1);
  expect(nodes.map((node) => node.style.display)).toEqual(['none', '', 'none']);
  selectPrintSheet(nodes, 2);
  expect(nodes.map((node) => node.style.display)).toEqual(['none', 'none', '']);
  expect(scroll).toHaveBeenLastCalledWith(0, 0);
});
