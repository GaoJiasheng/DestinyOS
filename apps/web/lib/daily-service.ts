import { createHash } from 'node:crypto';
import { BirthInputSchema, DailyChartSchema, type Locale } from '@tianji/shared';
import { ENGINE_VERSION } from '@tianji/engine/version';
import { currentProfile, ownedProfile } from './profile-service';
import { loadKnowledge } from './knowledge';
import { cacheRead, cacheWrite } from './cache';
import { ApiError } from './api-error';
import { ReportSchema } from './reading-schema';
import { calculateDaily, dailyCacheKey, dailyTTL, type DailyReport } from './daily-compute';
/** Owner-only daily cache, with zone validation to prevent reuse after travel or settings changes. */
export async function dailyForUser(
  userId: string,
  date: string,
  tz: string,
  locale: Locale,
  profileId?: string,
): Promise<DailyReport> {
  const profile = profileId ? await ownedProfile(userId, profileId) : await currentProfile(userId);
  if (!profile) throw new ApiError('E_PROFILE_REQUIRED', 'Birth profile required', 400);
  const knowledge = await loadKnowledge('daily', locale);
  const key = dailyCacheKey(
    `${userId}:${profile.id}`,
    profile.version,
    date,
    locale,
    knowledge.knowledgeVersion,
    ENGINE_VERSION,
  );
  const cached = await cacheRead<DailyReport>(key);
  if (cached) {
    const value: unknown = typeof cached === 'string' ? JSON.parse(cached) : cached;
    if (value && typeof value === 'object' && 'chart' in value && 'report' in value) {
      const chart = DailyChartSchema.safeParse(value.chart),
        report = ReportSchema.safeParse(value.report);
      if (chart.success && report.success && chart.data.date.tz === tz)
        return { chart: chart.data, report: report.data };
    }
  }
  const birth = BirthInputSchema.parse({
    ...JSON.parse(profile.encBirth),
    place: profile.encPlace ? JSON.parse(profile.encPlace) : undefined,
    gender: profile.gender,
  });
  const value = calculateDaily(
    birth,
    date,
    tz,
    createHash('sha256').update(`${userId}|${profile.id}|${date}`).digest('hex'),
    locale,
    knowledge,
  );
  const ttl = dailyTTL(date, tz);
  await cacheWrite(key, value, ttl);
  return value;
}
