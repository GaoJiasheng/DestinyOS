import type { DailyReport } from './daily-compute';
import type { DailyWorkerRequest, DailyWorkerResponse } from './daily-worker-types';
import asset from './daily-worker-asset.json';

/** One isolated calculation, cancelled and terminated on navigation/date/profile changes. */
export function calculateDailyInWorker(
  request: DailyWorkerRequest,
  signal: AbortSignal,
): Promise<DailyReport> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  const worker = new Worker(asset.url);
  return new Promise((resolve, reject) => {
    const finish = () => {
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
    try {
      worker.postMessage(request);
    } catch {
      finish();
      reject(new Error('E_INTERNAL'));
    }
  });
}
