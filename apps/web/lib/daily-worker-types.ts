import type { BirthInput, Locale } from '@tianji/shared';
import type { KnowledgeBundle } from '@tianji/content';
import type { DailyReport } from './daily-compute';

export type DailyWorkerRequest = {
  profile: BirthInput;
  date: string;
  tz: string;
  seed: string;
  locale: Locale;
  knowledge?: KnowledgeBundle;
};
export type DailyWorkerResponse =
  { ok: true; value: DailyReport } | { ok: false; code: 'E_INTERNAL' };
