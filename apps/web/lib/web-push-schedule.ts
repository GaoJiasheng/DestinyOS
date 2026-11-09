/** Pure scheduling rules for the daily web push reminder; no I/O so every edge can be unit-tested. */
export const REMINDER_HOURS = [6, 7, 8, 9, 12, 20] as const;
export const DEFAULT_REMINDER_HOUR = 8;
export const PUSH_LOCALES = ['zh', 'zh-TW', 'en'] as const;
export type PushLocale = (typeof PUSH_LOCALES)[number];
/** Consecutive non-404/410 failures before a subscription is disabled. */
export const MAX_PUSH_FAILURES = 5;
/** Per-cron ceilings: anything beyond them stays due and is picked up by the next hourly run. */
export const PUSH_BATCH_SIZE = 20;
export const PUSH_MAX_PER_RUN = 400;
export const PUSH_MAX_RUN_MS = 20_000;
/** How many hourly runs after the chosen hour may still deliver overflow left by the per-run ceilings. */
export const PUSH_CATCHUP_HOURS = 2;
/** Devices per account; the oldest are dropped so an account cannot grow an unbounded send list. */
export const PUSH_MAX_DEVICES_PER_USER = 10;

export function validTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone.length <= 64;
  } catch {
    return false;
  }
}

/** Wall-clock date (YYYY-MM-DD) and hour in an IANA zone; invalid zones fall back to UTC. */
export function localClock(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimeZone(timeZone) ? timeZone : 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    hour: Number(part('hour')) % 24,
  };
}

export type ReminderState = {
  timeZone: string;
  hour: number;
  /** Local date of the last successful (or claimed) send. */
  lastSentDate: string | null;
  disabledAt: Date | null;
};

/**
 * Due when the local wall clock is inside the chosen hour and nothing was sent on that local date.
 * The hourly cron fires at UTC :00, so :30/:45 offset zones are served 30 or 45 minutes into their hour.
 * A repeated hour on a DST fall-back day cannot double-send because the local date is already claimed.
 * `graceHours` widens the window for the sender so overflow from a capped run is not lost.
 */
export function reminderDue(state: ReminderState, now: Date, graceHours = 0): boolean {
  if (state.disabledAt) return false;
  const clock = localClock(now, state.timeZone);
  return (
    clock.hour >= state.hour &&
    clock.hour <= state.hour + graceHours &&
    state.lastSentDate !== clock.date
  );
}

export type ReminderCopy = { title: string; body: string };

function pushLocale(locale: string): PushLocale {
  return PUSH_LOCALES.find((entry) => entry === locale) ?? 'zh';
}

/**
 * Generic lock-screen-safe payload: never contains chart, score or any personal reading data.
 * The wording lives only in the message catalogs (push.reminder.*) and is passed in by the sender.
 */
export function reminderPayload(locale: string, copy: ReminderCopy): string {
  return JSON.stringify({ ...copy, url: `/${pushLocale(locale)}/today`, tag: 'daily-reminder' });
}
