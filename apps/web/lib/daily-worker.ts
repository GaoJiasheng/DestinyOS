import type { DailyReport } from './daily-compute';
import type { DailyWorkerRequest, DailyWorkerResponse } from './daily-worker-types';
import asset from './daily-worker-asset.json';
import type { Locale } from '@tianji/shared';

/**
 * One isolated calculation, cancelled and terminated on navigation/date/profile changes.
 * @param request Authenticated profile/date input, or its pending device decryption.
 * @param signal Cancellation when the view's date, profile or route changes.
 * @param locale Known UI locale selects the smaller zh/en worker before device decryption; omission keeps the full converter for existing callers.
 */
export function calculateDailyInWorker(
  request: DailyWorkerRequest | Promise<DailyWorkerRequest>,
  signal: AbortSignal,
  locale: Locale = 'zh-TW',
): Promise<DailyReport> {
  if (signal.aborted) {
    void Promise.resolve(request).catch(() => undefined);
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  const worker = new Worker(locale === 'zh-TW' ? asset.traditionalUrl : asset.url);
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = () => {
      finished = true;
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    worker.onmessage = (event: MessageEvent<DailyWorkerResponse>) => {
      finish();
      if (event.data.ok) resolve(event.data.value);
      else reject(new Error(event.data.code));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      reject(new Error('E_INTERNAL'));
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error('E_INTERNAL'));
    };
    signal.addEventListener('abort', abort, { once: true });
    // DESIGN-GAP: Initialize the worker while the encrypted device profile is read; only post authenticated input once ready, and never after cancellation.
    void Promise.resolve(request)
      .then((value) => {
        if (!finished) worker.postMessage(value);
      })
      .catch(() => {
        if (!finished) {
          finish();
          reject(new Error('E_INTERNAL'));
        }
      });
  });
}
