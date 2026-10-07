// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  printSettled,
  selectPrintSheet,
  zoomPrintReport,
  sizePoster,
  limitPosterHeight,
  compressPoster,
} from '../lib/platform/print-dom';

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

it('shrinks the whole A4 sheet without changing its logical width or going below 9pt', () => {
  const root = document.createElement('div');
  root.className = 'print-report';
  root.style.fontSize = '16px';
  root.innerHTML = '<div class="print-end-qr"><img /></div>';
  document.body.append(root);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const a4Width = (210 * 96) / 25.4;
  const initialZoom = 1654 / a4Width;
  vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => {
    const scale = Number(root.style.zoom || initialZoom) / initialZoom;
    return new DOMRect(0, 0, a4Width * Number(root.style.zoom || initialZoom), 18000 * scale);
  });
  expect(sizePoster()).toBe(18000);
  const logicalWidth = root.style.width;
  expect(limitPosterHeight(16000)).toBeLessThanOrEqual(16000);
  expect(root.style.width).toBe(logicalWidth);
  const zoom = Number(root.style.zoom);
  expect(16 * zoom).toBeGreaterThanOrEqual(25);
  expect(Number(root.dataset.posterScale)).toBeLessThan(1);
  const qr = root.querySelector('img')!;
  expect(parseFloat(qr.style.width) * zoom).toBeCloseTo(180);
  expect(parseFloat(qr.style.padding) * zoom).toBeCloseTo(12);
});

it('reports an impossible height at the type floor instead of cropping or squeezing line wrapping', () => {
  const root = document.createElement('div');
  root.className = 'print-report';
  root.style.fontSize = '12px';
  document.body.append(root);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const initialZoom = 1654 / ((210 * 96) / 25.4);
  vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, 1654, (20000 * Number(root.style.zoom || initialZoom)) / initialZoom),
  );
  sizePoster();
  expect(limitPosterHeight(16000)).toBeGreaterThan(16000);
  expect(12 * Number(root.style.zoom)).toBeGreaterThanOrEqual(25);
  expect(parseFloat(root.style.width)).toBeCloseTo((210 * 96) / 25.4);
});

it('re-encodes only the captured pixels, stops at quality 70 and retains the image dimensions', async () => {
  const dimensions = { width: 0, height: 0 };
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      naturalWidth = 1654;
      naturalHeight = 15000;
      async decode() {}
    },
  );
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    dimensions.width = this.width;
    dimensions.height = this.height;
    return `data:image/jpeg;base64,${'x'.repeat(4000004)}`;
  });
  try {
    await compressPoster('data:image/jpeg;base64,original');
    expect(dimensions).toEqual({ width: 1654, height: 15000 });
    expect(encode.mock.calls.map((call) => call[1])).toEqual([0.8, 0.76, 0.72, 0.7]);
    expect(drawImage).toHaveBeenCalledOnce();
    encode.mockClear().mockReturnValue('data:image/jpeg;base64,small');
    await compressPoster('data:image/jpeg;base64,original');
    expect(encode).toHaveBeenCalledExactlyOnceWith('image/jpeg', 0.8);
  } finally {
    vi.unstubAllGlobals();
  }
});
