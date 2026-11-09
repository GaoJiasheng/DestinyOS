import type { BirthInput, Locale } from '@tianji/shared';
import type { DailyRangeDay } from '@tianji/engine/daily';
import type { CalendarEvent } from '@tianji/engine/calendar';

type CalendarWorkerBase = {
  profile: BirthInput;
  tz: string;
  identity: string;
  locale: Locale;
};
export type CalendarWorkerRequest = CalendarWorkerBase &
  (
    | { month: string; from?: undefined; to?: undefined }
    | { month?: undefined; from: string; to: string }
  );
export type CalendarWorkerResponse =
  { ok: true; days: DailyRangeDay[]; events: CalendarEvent[] } | { ok: false; code: 'E_INTERNAL' };
