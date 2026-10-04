import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type Reading } from '@prisma/client';
import { z } from 'zod';
import { compute, normalizeBirth, EngineError, baziWarnings } from '@tianji/engine';
import { interpret } from '@tianji/interpret';
import {
  BirthInputSchema,
  BaziChartSchema,
  AstroChartSchema,
  VedicChartSchema,
  type BirthInput,
  type Locale,
  SpreadKeySchema,
  CategorySchema,
} from '@tianji/shared';
import { getDb } from './db';
import { loadKnowledge } from './knowledge';
import { stripPII } from './strip-pii';
import { isUnderThirteen } from './birth-form';
import { ApiError } from './api-error';
import {
  ReadingRequestSchema,
  ReportSchema,
  ReadingMetaSchema,
  type ReadingRequest,
  type ReadingView,
} from './reading-schema';
import { getLocalRedis, getUpstashRedis } from './redis';
/** SHA-256 identifiers keep private request/owner values out of cache keys. */
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
/** Serialize validated domain data into Prisma-compatible JSON values. */
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
/** Reject underage requests before computing or storing any profile or reading. */
export function checkAge(birth: BirthInput, locale: Locale) {
  if (isUnderThirteen(birth, locale)) throw new ApiError('E_AGE_RESTRICTED', 'Age restricted', 403);
}
/** Compute then interpret using one immutable chart; callers persist only sanitized derivatives. */
export async function generateReading(req: ReadingRequest, now: string, userId?: string) {
  const birth = req.birth ? normalizeBirth(req.birth, req.locale) : null;
  if (req.birth) checkAge(req.birth, req.locale);
  // DESIGN-GAP: 07's flat divination fields are adapted to each pure engine's existing input shape.
  const questionRecord = typeof req.question === 'string' ? { text: req.question } : req.question;
  let question = questionRecord;
  if (req.system === 'iching') {
    const { text, ...rest } = questionRecord ?? {};
    const method = req.method ?? rest.method ?? 'meihua';
    question = {
      ...rest,
      method,
      category: req.category ?? rest.category ?? 'other',
      ...(typeof text === 'string' ? { question: text } : {}),
      ...(req.numbers
        ? { meihua: { castBy: 'numbers', numbers: req.numbers, at: `${now}[UTC]` } }
        : {}),
      ...(req.throws ? { liuyao: { throws: req.throws } } : {}),
    };
  } else if (req.system === 'qimen') {
    const { text, ...rest } = questionRecord ?? {};
    question = {
      ...rest,
      ...(req.category ? { category: req.category } : {}),
      ...(typeof text === 'string' ? { question: text } : {}),
    };
  }
  const result = compute({
    system: req.system,
    birth,
    now,
    options: req.options,
    question,
    seed: req.seed ?? digest(req.idempotencyKey),
    spread: req.spread ? SpreadKeySchema.parse(req.spread) : undefined,
    category:
      req.system === 'tarot' && req.category ? CategorySchema.parse(req.category) : undefined,
  });
  const knowledge = await loadKnowledge(req.system, req.locale);
  const report = interpret({
    system: req.system,
    chart: result.chart,
    locale: req.locale,
    knowledge,
    context: {
      now,
      profileHasTime: !birth?.timeUnknown,
      engineVersion: result.engineVersion,
      userId,
    },
  });
  // DESIGN-GAP: Preserve the shape expected by chart schemas while masking original/adjusted birth timestamps.
  const chart = stripPII(result.chart);
  const meta = ReadingMetaSchema.parse({
    ...result.meta,
    debug: stripPII({ ...result.meta.debug, solarTime: birth?.solarTime }),
  });
  return { chart, report, meta, birthYear: birth?.local.year, displayName: req.displayName };
}
/** Fetch one locale from its saved snapshot; generate only a missing translation from the same chart. */
export async function readingView(
  row: Reading,
  locale: Locale,
  owner: boolean,
): Promise<ReadingView> {
  let report: unknown = locale === 'zh' ? row.reportZh : row.reportEn;
  const snapshot = ReadingRequestSchema.parse(JSON.parse(row.encInput));
  if (!report) {
    report = json(
      interpret({
        system: row.system,
        chart: row.chart,
        locale,
        knowledge: await loadKnowledge(row.system, locale),
        context: {
          now: row.createdAt.toISOString(),
          profileHasTime: !snapshot.birth?.timeUnknown,
          engineVersion: row.engineVersion,
          userId: row.userId ?? undefined,
        },
      }),
    );
    await getDb().reading.update({
      where: { id: row.id },
      data: locale === 'zh' ? { reportZh: json(report) } : { reportEn: json(report) },
    });
  }
  const profile = row.profileId
    ? await getDb().birthProfile.findUnique({
        where: { id: row.profileId },
        select: { isCurrent: true },
      })
    : null;
  const normalized = snapshot.birth ? normalizeBirth(snapshot.birth, locale) : null;
  const bazi = row.system === 'bazi' ? BaziChartSchema.safeParse(row.chart) : null;
  const astro = row.system === 'astrology' ? AstroChartSchema.safeParse(row.chart) : null;
  const vedic = row.system === 'vedic' ? VedicChartSchema.safeParse(row.chart) : null;
  const warnings = [
    ...(normalized?.warnings ?? []),
    ...(normalized && bazi?.success ? baziWarnings(normalized, bazi.data) : []),
    ...((astro?.success && astro.data.noonChart) || (vedic?.success && vedic.data.noonChart)
      ? [{ code: 'W_NOON_CHART' as const, messageKey: 'engine.warnings.W_NOON_CHART' }]
      : []),
    ...(astro?.success &&
    astro.data.houseSystem === 'whole_sign' &&
    (snapshot.options?.school?.houseSystem === undefined ||
      snapshot.options.school.houseSystem === 'placidus')
      ? [
          {
            code: 'W_HOUSE_SYSTEM_FALLBACK' as const,
            messageKey: 'engine.warnings.W_HOUSE_SYSTEM_FALLBACK',
          },
        ]
      : []),
  ];
  return {
    id: row.id,
    system: row.system,
    createdAt: row.createdAt.toISOString(),
    title: row.title,
    chart: row.chart,
    report: ReportSchema.parse(report),
    meta: {
      schoolUsed: ReadingMetaSchema.shape.schoolUsed.parse(row.schoolUsed),
      warnings,
      debug: {
        engineVersion: row.engineVersion,
        solarTime: stripPII(normalized?.solarTime),
        ...(astro?.success ? { jdUT: astro.data.jdUT, obliquity: astro.data.obliquity } : {}),
        ...(vedic?.success ? { jdUT: vedic.data.jdUT, ayanamsa: vedic.data.ayanamsa } : {}),
      },
    },
    birthYear: normalized?.local.year,
    displayName: owner ? snapshot.displayName : undefined,
    isPublic: row.isPublic,
    staleProfile: profile?.isCurrent === false,
  };
}
/** Save chart/report plaintext and input via the existing AES-GCM Prisma extension. */
export async function persistReading(
  userId: string,
  req: ReadingRequest,
  now: string,
  id?: string,
  profile?: { id: string; version: number },
) {
  const generated = await generateReading(req, now, userId);
  const row = await getDb().reading.create({
    data: {
      id,
      userId,
      profileId: profile?.id,
      profileVersion: profile?.version,
      system: req.system,
      encInput: JSON.stringify(req),
      chart: json(generated.chart),
      schoolUsed: json(generated.meta.schoolUsed),
      engineVersion: generated.report.engineVersion,
      interpretVersion: generated.report.interpretVersion,
      knowledgeVersion: generated.report.knowledgeVersion,
      ...(req.locale === 'zh'
        ? { reportZh: json(generated.report) }
        : { reportEn: json(generated.report) }),
    },
  });
  return { readingId: row.id, ...generated };
}
/** Expand the current encrypted profile when a signed-in request omits birth. */
export async function resolveBirth(req: ReadingRequest, userId?: string) {
  if (req.birth || !['bazi', 'ziwei', 'astrology', 'vedic'].includes(req.system)) return { req };
  if (!userId) throw new ApiError('E_PROFILE_REQUIRED', 'Birth input required', 400);
  const profile = await getDb().birthProfile.findFirst({ where: { userId, isCurrent: true } });
  if (!profile) throw new ApiError('E_PROFILE_REQUIRED', 'Profile required', 400);
  const birth = BirthInputSchema.parse({
    ...JSON.parse(profile.encBirth),
    place: profile.encPlace ? JSON.parse(profile.encPlace) : undefined,
    gender: profile.gender,
  });
  return { req: { ...req, birth, displayName: profile.encName ?? undefined }, profile };
}
/** Cache only hashes, a timestamp and the persisted ID; no anonymous PII enters Redis. */
export async function idempotentCreate(
  req: ReadingRequest,
  identity: string,
  userId?: string,
  profile?: { id: string; version: number },
) {
  const key = `reading:idempotency:${digest(identity + ':' + req.idempotencyKey)}`;
  const fingerprint = digest(JSON.stringify(req));
  const redis = process.env.UPSTASH_REDIS_REST_URL ? getUpstashRedis() : getLocalRedis();
  const token = randomUUID();
  const locked = process.env.UPSTASH_REDIS_REST_URL
    ? await getUpstashRedis().set(key + ':lock', token, { nx: true, ex: 30 })
    : await getLocalRedis().set(key + ':lock', token, 'EX', 30, 'NX');
  if (!locked) throw new ApiError('E_CONFLICT', 'Request is already in progress', 409);
  try {
    const raw = await redis.get(key);
    const prior = raw
      ? z
          .object({ fingerprint: z.string(), now: z.string(), readingId: z.string().optional() })
          .parse(typeof raw === 'string' ? JSON.parse(raw) : raw)
      : null;
    if (prior && prior.fingerprint !== fingerprint)
      throw new ApiError('E_VALIDATION', 'Idempotency key reused with different input', 409);
    const now = prior?.now ?? new Date().toISOString();
    if (prior?.readingId) {
      const row = await getDb().reading.findFirst({ where: { id: prior.readingId, userId } });
      if (!row) throw new ApiError('E_NOT_FOUND', 'Reading no longer exists', 404);
      const view = await readingView(row, req.locale, true);
      return {
        readingId: row.id,
        chart: view.chart,
        report: view.report,
        meta: view.meta,
        birthYear: view.birthYear,
        displayName: view.displayName,
      };
    }
    // DESIGN-GAP: A deterministic owner-scoped ID also prevents duplicates after a process dies between DB write and cache write.
    const id = userId ? `r${digest(userId + ':' + req.idempotencyKey).slice(0, 30)}` : undefined;
    const existing = id ? await getDb().reading.findFirst({ where: { id, userId } }) : null;
    const result = existing
      ? { readingId: existing.id, ...(await readingView(existing, req.locale, true)) }
      : userId
        ? await persistReading(userId, req, now, id, profile)
        : await generateReading(req, now);
    const record = {
      fingerprint,
      now,
      ...('readingId' in result ? { readingId: result.readingId } : {}),
    };
    if (process.env.UPSTASH_REDIS_REST_URL) await getUpstashRedis().set(key, record, { ex: 600 });
    else await getLocalRedis().set(key, JSON.stringify(record), 'EX', 600);
    return result;
  } finally {
    const script =
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
    if (process.env.UPSTASH_REDIS_REST_URL)
      await getUpstashRedis().eval(script, [key + ':lock'], [token]);
    else await getLocalRedis().eval(script, 1, key + ':lock', token);
  }
}
/** Map domain errors without passing birth data or exception details to the client. */
export function actionError(error: unknown): string {
  return error instanceof ApiError || error instanceof EngineError
    ? error.code
    : error instanceof z.ZodError
      ? 'E_VALIDATION'
      : 'E_INTERNAL';
}
export { json, digest };
