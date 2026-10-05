import type { KnowledgeBundle } from '@tianji/content';
import knowledge from '../../../packages/content/dist/daily.zh.json';
import { calculateDaily } from './daily-compute';
import type { DailyWorkerRequest, DailyWorkerResponse } from './daily-worker-types';

// DESIGN-GAP: Anonymous daily computation runs in a same-origin Worker to keep mobile input responsive; profiles never leave the browser and errors contain no input.
self.addEventListener('message', (event: MessageEvent<DailyWorkerRequest>) => {
  let response: DailyWorkerResponse;
  try {
    const { profile, date, tz, seed, locale } = event.data;
    response = {
      ok: true,
      value: calculateDaily(
        profile,
        date,
        tz,
        seed,
        locale,
        knowledge as unknown as KnowledgeBundle,
      ),
    };
  } catch {
    response = { ok: false, code: 'E_INTERNAL' };
  }
  self.postMessage(response);
});
