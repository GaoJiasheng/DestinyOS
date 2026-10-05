import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateDailyInWorker } from '../lib/daily-worker';
import type { DailyWorkerRequest, DailyWorkerResponse } from '../lib/daily-worker-types';

class BrowserWorker {
  static instances: BrowserWorker[] = [];
  onmessage: ((event: MessageEvent<DailyWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn<(request: DailyWorkerRequest) => void>();
  terminate = vi.fn();
  constructor() {
    BrowserWorker.instances.push(this);
  }
}
const request: DailyWorkerRequest = {
  profile: {
    calendar: 'gregorian',
    year: 1990,
    month: 5,
    day: 15,
    hour: 8,
    minute: 30,
    gender: 'male',
    timeUnknown: false,
    place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  },
  date: '2026-10-04',
  tz: 'Asia/Shanghai',
  seed: 'fixture-daily',
  locale: 'zh',
};
beforeEach(() => {
  BrowserWorker.instances = [];
  vi.stubGlobal('Worker', BrowserWorker);
});
afterEach(() => vi.unstubAllGlobals());
describe('anonymous daily worker lifecycle', () => {
  it('starts before profile decryption finishes and posts only the resolved input', async () => {
    let resolveInput!: (value: DailyWorkerRequest) => void;
    const input = new Promise<DailyWorkerRequest>((resolve) => {
      resolveInput = resolve;
    });
    const pending = calculateDailyInWorker(input, new AbortController().signal);
    const rejected = expect(pending).rejects.toThrow('E_INTERNAL');
    const worker = BrowserWorker.instances[0]!;
    expect(worker.postMessage).not.toHaveBeenCalled();
    resolveInput(request);
    await Promise.resolve();
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith(request);
    worker.onmessage!({
      data: { ok: false, code: 'E_INTERNAL' },
    } as MessageEvent<DailyWorkerResponse>);
    await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('never posts a late profile after navigation cancels the calculation', async () => {
    let resolveInput!: (value: DailyWorkerRequest) => void;
    const input = new Promise<DailyWorkerRequest>((resolve) => {
      resolveInput = resolve;
    });
    const controller = new AbortController();
    const pending = calculateDailyInWorker(input, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    resolveInput(request);
    await rejected;
    expect(BrowserWorker.instances[0]!.postMessage).not.toHaveBeenCalled();
    expect(BrowserWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
  });
  it('terminates on decryption failure without exposing the private error', async () => {
    const pending = calculateDailyInWorker(
      Promise.reject(new Error('Private birth 1990-05-15')),
      new AbortController().signal,
    );
    await expect(pending).rejects.toThrow('E_INTERNAL');
    expect(BrowserWorker.instances[0]!.postMessage).not.toHaveBeenCalled();
    expect(BrowserWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
  });
  it('cancels obsolete profile/date computations and releases their worker', async () => {
    const controller = new AbortController();
    const pending = calculateDailyInWorker(request, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(BrowserWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    await expect(calculateDailyInWorker(request, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    await expect(
      calculateDailyInWorker(Promise.reject(new Error('Private profile')), controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(BrowserWorker.instances).toHaveLength(1);
  });
  it('reports a sanitized failure and terminates a broken worker', async () => {
    const pending = calculateDailyInWorker(request, new AbortController().signal);
    const rejected = expect(pending).rejects.toThrow('E_INTERNAL');
    const worker = BrowserWorker.instances[0]!;
    const event = {
      message: 'private birth 1990-05-15',
      preventDefault: vi.fn(),
    } as unknown as ErrorEvent;
    worker.onerror!(event);
    await rejected;
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
