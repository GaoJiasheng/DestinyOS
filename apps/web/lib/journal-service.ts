import { Temporal } from '@js-temporal/polyfill';
import {
  JournalInputSchema,
  JournalKeySchema,
  JournalPredictionSchema,
  type JournalEntryView,
  type Locale,
} from '@tianji/shared';
import { computeDailyRange } from '@tianji/engine/daily';
import { ENGINE_VERSION } from '@tianji/engine/version';
import type { JournalEntry } from '@prisma/client';
import { getDb } from './db';
import { atomicBatch, guard, insertRow, updateRows, type SqlStatement } from './db-batch';
import { ownedProfile, profileBirth } from './profile-service';
import { ApiError } from './api-error';
import { localToday } from './daily-date';
import { journalStats } from './journal-stats';
function view(row: JournalEntry): JournalEntryView {
  return {
    id: row.id,
    profileId: row.profileId,
    date: row.date.toISOString().slice(0, 10),
    mood: row.mood,
    text: row.text,
    prediction: JournalPredictionSchema.parse(row.prediction),
    createdAt: row.createdAt.toISOString(),
  };
}
/** Read only an owned profile's entry, exposing plaintext solely at the authenticated boundary. */
export async function journalEntryForUser(userId: string, raw: unknown) {
  const input = JournalKeySchema.parse(raw);
  await ownedProfile(userId, input.profileId);
  const row = await getDb().journalEntry.findFirst({
    where: {
      userId,
      profileId: input.profileId,
      date: new Date(`${input.date}T00:00:00Z`),
    },
  });
  return row ? view(row) : null;
}
/** Save or revise one civil day's mood and encrypted sentence; retain the first prediction snapshot. */
export async function saveJournalEntry(
  userId: string,
  raw: unknown,
  locale: Locale,
  sync?: { createId: string; checks: SqlStatement[]; after?: SqlStatement[] },
) {
  const input = JournalInputSchema.parse(raw);
  // DESIGN-GAP: Allow past-day reflection but reject future moods in the selected IANA zone.
  if (input.date > localToday(input.tz))
    throw new ApiError('E_DATE_OUT_OF_RANGE', 'Future journal date', 400);
  const db = getDb();
  const tx = db;
  return (async () => {
    // DESIGN-GAP: Serialize writes with profile edits and account deletion; no entry can survive a concurrent soft delete.

    const user = await tx.user.findUnique({ where: { id: userId }, select: { deletedAt: true } });
    if (!user || user.deletedAt) throw new ApiError('E_UNAUTHORIZED', 'Account unavailable', 401);
    const profile = await tx.birthProfile.findFirst({
      where: { id: input.profileId, userId, isCurrent: true },
    });
    if (!profile) throw new ApiError('E_FORBIDDEN', 'Profile access denied', 403);
    const date = new Date(`${input.date}T00:00:00Z`);
    const existing = await tx.journalEntry.findUnique({
      where: { profileId_date: { profileId: profile.id, date } },
    });
    const checks = [
      ...(sync?.checks ?? []),
      ...guard(
        'EXISTS (SELECT 1 FROM "User" u JOIN "BirthProfile" p ON p."userId"=u.id WHERE u.id=? AND u."deletedAt" IS NULL AND p.id=? AND p.version=? AND p."isCurrent"=1)',
        userId,
        profile.id,
        profile.version,
      ),
    ];
    if (existing) {
      await atomicBatch([
        ...checks,
        updateRows(
          'JournalEntry',
          { userId, mood: input.mood, text: input.text },
          'id=? AND "userId"=?',
          existing.id,
          userId,
        ),
        ...(sync?.after ?? []),
      ]);
      return view(await tx.journalEntry.findUniqueOrThrow({ where: { id: existing.id } }));
    }
    const forecast = computeDailyRange(
      profileBirth(profile),
      input.date,
      input.date,
      input.tz,
      `${userId}|${profile.id}`,
      locale,
    )[0];
    if (!forecast) throw new ApiError('E_INTERNAL', 'Prediction unavailable', 500);
    const prediction = JournalPredictionSchema.parse({
      scores: forecast.scores,
      tz: input.tz,
      profileVersion: profile.version,
      engineVersion: ENGINE_VERSION,
    });
    await atomicBatch([
      ...checks,
      insertRow(
        'JournalEntry',
        {
          id: sync?.createId,
          userId,
          profileId: profile.id,
          date,
          mood: input.mood,
          text: input.text,
          prediction,
        },
        'ON CONFLICT("profileId",date) DO UPDATE SET mood=excluded.mood,text=excluded.text',
      ),
      ...(sync?.after ?? []),
    ]);
    return view(
      await tx.journalEntry.findUniqueOrThrow({
        where: { profileId_date: { profileId: profile.id, date } },
      }),
    );
  })();
}
/** Bounded month list with full profile statistics; unrecorded cells use current calendar scores. */
export async function journalMonthForUser(
  userId: string,
  profileId: string,
  month: string,
  tz: string,
  locale: Locale,
) {
  const profile = await ownedProfile(userId, profileId);
  const start = Temporal.PlainDate.from(`${month}-01`),
    end = start.with({ day: start.daysInMonth });
  const rows = await getDb().journalEntry.findMany({
    where: {
      userId,
      profileId,
      date: { gte: new Date(`${start}T00:00:00Z`), lte: new Date(`${end}T00:00:00Z`) },
    },
    orderBy: { date: 'desc' },
  });
  const samples = await getDb().journalEntry.findMany({
    where: { userId, profileId },
    select: { date: true, mood: true, prediction: true },
    orderBy: { date: 'asc' },
  });
  return {
    entries: rows.map(view),
    days: computeDailyRange(
      profileBirth(profile),
      start.toString(),
      end.toString(),
      tz,
      `${userId}|${profile.id}`,
      locale,
    ),
    stats: journalStats(
      samples.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        mood: row.mood,
        prediction: JournalPredictionSchema.parse(row.prediction),
      })),
      localToday(tz),
    ),
  };
}
export type JournalMonth = Awaited<ReturnType<typeof journalMonthForUser>>;
