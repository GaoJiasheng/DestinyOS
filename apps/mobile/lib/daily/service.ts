import * as Crypto from 'expo-crypto';
import { ENGINE_VERSION } from '@tianji/engine/version';
import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import { compute, hashSeed, normalizeBirth, computeDailyRange } from '@tianji/engine';
import { DailyChartSchema, JournalDateSchema } from '@tianji/shared';
import { interpret, localizeReport, type Report } from '@tianji/interpret';
import { getOfflineKnowledge } from '../knowledge';
import { getLocalStore } from '../data/store';
import { JournalSchema, ReadingSchema, type LocalRecord, type Profile } from '../data/models';
import type { MobileLocale } from '../i18n';

export const domains = ['career', 'wealth', 'love', 'health', 'social'] as const;
export type NativeDaily = {
  id: string | null;
  chart: z.infer<typeof DailyChartSchema>;
  report: Report;
  engineVersion: string;
};
// DESIGN-GAP: Public sample uses a synthetic adult birthday, never a real person's fixture.
const exampleBirth = {
  calendar: 'gregorian' as const,
  year: 1990,
  month: 5,
  day: 15,
  timeUnknown: true,
  gender: 'unspecified' as const,
  place: { name: 'UTC 0°', lat: 0, lng: 0, tz: 'UTC' },
};
/** Civil date in the configured device timezone; explicit instants make DST tests deterministic. */
export function todayIn(tz: string, now = Temporal.Now.instant().toString()) {
  return Temporal.Instant.from(now).toZonedDateTimeISO(tz).toPlainDate().toString();
}
/** Validate routed dates before any engine or SQLite use. */
export function dailyDate(requested: unknown, tz: string) {
  return JournalDateSchema.safeParse(requested).success ? String(requested) : todayIn(tz);
}
/** Stable profile/version/zone/date identity; includes release versions when loading saved snapshots. */
export async function loadDaily(
  profile: LocalRecord<Profile> | null,
  date: string,
  tz: string,
  locale: MobileLocale,
): Promise<NativeDaily> {
  JournalDateSchema.parse(date);
  const knowledge = await getOfflineKnowledge('daily');
  const identity = profile?.id ?? 'example';
  const id = `daily:${hashSeed(`${identity}|${profile?.data?.version ?? 1}|${date}|${tz}|${knowledge.knowledgeVersion}|${ENGINE_VERSION}`)}`;
  const store = await getLocalStore();
  const previous = profile ? await store.readings.get(id) : null;
  const time = Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: tz, plainTime: '12:00' });
  // Always dispatch through the shared engine, including its explicit IANA timezone.
  const result = compute({
    system: 'daily',
    birth: normalizeBirth(profile?.data?.birth ?? exampleBirth),
    now: time,
    seed: hashSeed(`${identity}|${date}`),
  });
  const chart = DailyChartSchema.parse(result.chart);
  const reports = (['zh', 'en'] as const).map((language) =>
    interpret({
      system: 'daily',
      chart,
      locale: language,
      knowledge,
      context: {
        now: time.toInstant().toString(),
        profileHasTime: !(profile?.data?.birth ?? exampleBirth).timeUnknown,
        engineVersion: result.engineVersion,
      },
    }),
  );
  // DESIGN-GAP: Refresh recomputes deterministically but reuses the same encrypted record/votes; no public sample is persisted.
  if (profile?.data) {
    await store.readings.save(
      {
        profileId: profile.id,
        profileVersion: profile.data.version,
        system: 'daily',
        status: 'ok',
        inputSnapshot:
          previous?.data?.inputSnapshot ??
          ReadingSchema.innerType().shape.inputSnapshot.parse({
            system: 'daily',
            idempotencyKey: Crypto.randomUUID(),
            profileId: profile.id,
            birth: profile.data.birth,
            seed: hashSeed(`${identity}|${date}`),
          }),
        chart,
        reportZh: { ...reports[0]! },
        reportEn: { ...reports[1]! },
        schoolUsed: result.meta.schoolUsed,
        meta: result.meta,
        engineVersion: result.engineVersion,
        interpretVersion: reports[0]!.interpretVersion,
        knowledgeVersion: knowledge.knowledgeVersion,
        title: null,
        isPublic: false,
      },
      previous?.id ?? id,
    );
  }
  return {
    id: profile ? id : null,
    chart,
    report: localizeReport(reports[locale === 'en' ? 1 : 0]!, locale),
    engineVersion: result.engineVersion,
  };
}
/** Month heatmap uses the shared optimized range engine and the same profile/date seed as Today. */
export function monthDays(
  profile: LocalRecord<Profile>,
  month: string,
  tz: string,
  locale: MobileLocale,
) {
  if (!profile.data) throw new Error('E_FORBIDDEN');
  const first = Temporal.PlainDate.from(`${month}-01`);
  return computeDailyRange(
    profile.data.birth,
    first.toString(),
    first.with({ day: first.daysInMonth }).toString(),
    tz,
    profile.id,
    locale,
  );
}
/** Owner-scoped, paginated journal read: never truncate long-term statistics to 500 records. */
export async function profileJournal(profileId: string) {
  const store = await getLocalStore();
  const entries: LocalRecord<z.infer<typeof JournalSchema>>[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await store.journal.list(500, offset);
    entries.push(...page.filter((entry) => entry.data?.profileId === profileId));
    if (page.length < 500) break;
  }
  return entries;
}

/** Prior Vedic use must remain discoverable after years of daily history, within the current owner scope. */
export async function hasVedicHistory() {
  const store = await getLocalStore();
  for (let offset = 0; ; offset += 500) {
    const page = await store.readings.list(500, offset);
    if (page.some((record) => record.data?.system === 'vedic')) return true;
    if (page.length < 500) return false;
  }
}
