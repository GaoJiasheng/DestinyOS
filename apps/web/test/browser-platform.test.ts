import { afterEach, expect, it, vi } from 'vitest';
import { openCloudflarePage } from '../lib/platform/browser-cloudflare';
const mock = vi.hoisted(() => ({
  launch: vi.fn(),
  close: vi.fn(),
  newPage: vi.fn(),
  on: vi.fn(),
  evaluate: vi.fn(),
  goto: vi.fn(),
  viewport: vi.fn(),
  pdf: vi.fn(),
  screenshot: vi.fn(),
  sheets: vi.fn(),
}));
vi.mock('@cloudflare/puppeteer', () => ({ default: { launch: mock.launch } }));
vi.mock('../lib/platform/cloudflare', () => ({
  cloudflareBindings: async () => ({ BROWSER: 'isolated-browser-binding' }),
}));
afterEach(() => vi.clearAllMocks());
it('uses the browser binding, restricts requests, validates fonts/pagination and renders A4 or 300dpi pages', async () => {
  const noop = async () => undefined;
  mock.launch.mockResolvedValue({ newPage: mock.newPage, close: mock.close });
  mock.newPage.mockResolvedValue({
    setViewport: mock.viewport,
    emulateMediaFeatures: noop,
    setBypassServiceWorker: noop,
    setRequestInterception: noop,
    on: mock.on,
    goto: mock.goto,
    waitForFunction: noop,
    evaluate: mock.evaluate,
    emulateMediaType: noop,
    pdf: mock.pdf,
    $eval: noop,
    $$eval: mock.sheets,
    screenshot: mock.screenshot,
  });
  mock.goto.mockResolvedValue({ ok: () => true });
  mock.evaluate.mockResolvedValue(true);
  mock.pdf.mockResolvedValue(new Uint8Array([1]));
  mock.screenshot.mockResolvedValue(new Uint8Array([2]));
  mock.sheets.mockResolvedValue(3);
  const page = await openCloudflarePage(
    'https://isolated.example',
    '/en/bazi/r/id/print',
    'capability',
  );
  expect(mock.launch).toHaveBeenCalledWith('isolated-browser-binding');
  const listener = mock.on.mock.calls[0]?.[1] as (request: {
    url(): string;
    headers(): Record<string, string>;
    isNavigationRequest(): boolean;
    abort(): Promise<void>;
    continue(options: { headers: Record<string, string> }): Promise<void>;
  }) => void;
  const abort = vi.fn(noop),
    proceed = vi.fn(noop);
  listener({
    url: () => 'https://third-party.example/font.woff2',
    headers: () => ({}),
    isNavigationRequest: () => false,
    abort,
    continue: proceed,
  });
  expect(abort).toHaveBeenCalledOnce();
  listener({
    url: () => 'https://isolated.example/en/bazi/r/id/print?theme=dark',
    headers: () => ({}),
    isNavigationRequest: () => true,
    abort,
    continue: proceed,
  });
  expect(proceed).toHaveBeenCalledWith({ headers: { 'x-report-print-token': 'capability' } });
  listener({
    url: () => 'https://isolated.example/fonts/ui.woff2',
    headers: () => ({}),
    isNavigationRequest: () => false,
    abort,
    continue: proceed,
  });
  expect(proceed).toHaveBeenLastCalledWith({ headers: {} });
  await page.navigate('https://isolated.example/en/bazi/r/id/print');
  await page.validate();
  expect(await page.pageCount()).toBe(3);
  expect(await page.pdf()).toEqual(new Uint8Array([1]));
  expect(mock.pdf).toHaveBeenCalledWith({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
  });
  await page.preparePng();
  expect(mock.viewport).toHaveBeenLastCalledWith({
    width: 2480,
    height: 3508,
    deviceScaleFactor: 1,
  });
  expect(await page.screenshot(2)).toEqual(new Uint8Array([2]));
  mock.evaluate.mockResolvedValue(false);
  await expect(page.validate()).rejects.toThrow('Print fonts or pagination failed');
  await page.close();
  expect(mock.close).toHaveBeenCalledOnce();
});
