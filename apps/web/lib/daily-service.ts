import { createHash } from 'node:crypto';
import { BirthInputSchema, DailyChartSchema, type Locale } from '@tianji/shared';
import { ENGINE_VERSION } from '@tianji/engine';
import { getDb } from './db';
import { loadKnowledge } from './knowledge';
import { getLocalRedis, getUpstashRedis } from './redis';
import { ApiError } from './api-error';
import { ReportSchema } from './reading-schema';
import { calculateDaily, dailyCacheKey, dailyTTL, type DailyReport } from './daily-compute';
/** Owner-only daily cache, with zone validation to prevent reuse after travel or settings changes. */
export async function dailyForUser(
  userId: string,
  date: string,
  tz: string,
  locale: Locale,
): Promise<DailyReport> {
  const profile = await getDb().birthProfile.findFirst({ where: { userId, isCurrent: true } });
  if (!profile) throw new ApiError('E_PROFILE_REQUIRED', 'Birth profile required', 400);
  const knowledge = await loadKnowledge('daily', locale);
  const key = dailyCacheKey(
    userId,
    profile.version,
    date,
    locale,
    knowledge.knowledgeVersion,
    ENGINE_VERSION,
  );
  const remote = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const cached = remote
    ? await getUpstashRedis().get<DailyReport>(key)
    : await getLocalRedis().get(key);
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
    createHash('sha256').update(`${userId}|${date}`).digest('hex'),
    locale,
    knowledge,
  );
  const ttl = dailyTTL(date, tz);
  if (remote) await getUpstashRedis().set(key, value, { ex: ttl });
  else await getLocalRedis().set(key, JSON.stringify(value), 'EX', ttl);
  return value;
}
