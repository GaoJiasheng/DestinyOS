import asset from './daily-worker-asset.json';
import type { CalendarWorkerRequest, CalendarWorkerResponse } from './calendar-worker-types';

/** Compute local calendar scores/events and terminate on completion or navigation. */
export function calculateCalendarInWorker(request: CalendarWorkerRequest, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  const worker = new Worker(asset.calendarUrl);
  return new Promise<Extract<CalendarWorkerResponse, { ok: true }>>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    worker.onmessage = (event: MessageEvent<CalendarWorkerResponse>) => {
      finish();
      if (event.data.ok) resolve(event.data);
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
    worker.postMessage(request);
  });
}
