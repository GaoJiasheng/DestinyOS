import type { BirthInput, Locale } from '@tianji/shared';
import type { DailyRangeDay } from '@tianji/engine/daily';
import type { CalendarEvent } from '@tianji/engine/calendar';

export type CalendarWorkerRequest = {
  profile: BirthInput;
  month: string;
  tz: string;
  identity: string;
  locale: Locale;
};
export type CalendarWorkerResponse =
  { ok: true; days: DailyRangeDay[]; events: CalendarEvent[] } | { ok: false; code: 'E_INTERNAL' };
