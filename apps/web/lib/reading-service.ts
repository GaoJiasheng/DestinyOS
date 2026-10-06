import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type Reading } from '@prisma/client';
import { z } from 'zod';
import { compute, normalizeBirth, baziWarnings } from '@tianji/engine';
import { interpret, localizeReport } from '@tianji/interpret';
import {
  BaziChartSchema,
  AstroChartSchema,
  VedicChartSchema,
  type BirthInput,
  type Locale,
  SpreadKeySchema,
  CategorySchema,
  System,
} from '@tianji/shared';
import { getDb } from './db';
import { currentProfile, profileBirth, ownedProfile } from './profile-service';
import { recordEvent } from './events';
import { loadKnowledge } from './knowledge';
import { computeDivinationResult } from './divination';
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
import { stateRead, stateWrite, stateReserve, stateRelease } from './state';
import { atomicBatch, guard, insertRow, statement, type SqlStatement } from './db-batch';
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
  if (req.partnerBirth) checkAge(req.partnerBirth, req.locale);
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
  const result =
    ['iching', 'qimen'].includes(req.system) &&
    typeof req.question === 'object' &&
    ('at' in req.question || 'meihua' in req.question)
      ? computeDivinationResult(req)
      : compute({
          system: req.system,
          name: req.name,
          birth,
          partnerBirth: req.partnerBirth ? normalizeBirth(req.partnerBirth, req.locale) : undefined,
          now,
          options: req.options,
          allowReversed: req.allowReversed,
          pickedIndices: req.pickedIndices,
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
    timeSource: req.birth?.timeSource,
    rectificationConfidence: req.birth?.rectificationConfidence,
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
  const system = z.nativeEnum(System).parse(row.system);
  let report: unknown = locale !== 'en' ? row.reportZh : row.reportEn;
  const snapshot = ReadingRequestSchema.parse(JSON.parse(row.encInput));
  if (!report) {
    report = json(
      interpret({
        system,
        chart: row.chart,
        locale: locale === 'en' ? 'en' : 'zh',
        knowledge: await loadKnowledge(system, locale, row.knowledgeVersion),
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
      data: locale !== 'en' ? { reportZh: json(report) } : { reportEn: json(report) },
    });
  }
  const profile = row.profileId
    ? await getDb().birthProfile.findUnique({
        where: { id: row.profileId },
        select: { isCurrent: true, version: true },
      })
    : null;
  const partnerProfile = row.partnerProfileId
    ? await getDb().birthProfile.findUnique({
        where: { id: row.partnerProfileId },
        select: { isCurrent: true, version: true },
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
    system,
    createdAt: row.createdAt.toISOString(),
    title: row.title,
    chart: row.chart,
    report: localizeReport(ReportSchema.parse(report), locale),
    meta: {
      timeSource: snapshot.birth?.timeSource,
      rectificationConfidence: snapshot.birth?.rectificationConfidence,
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
    staleProfile:
      profile?.isCurrent === false ||
      (!!profile && row.profileVersion !== profile.version) ||
      partnerProfile?.isCurrent === false ||
      (!!partnerProfile && snapshot.partnerProfileVersion !== partnerProfile.version),
  };
}
/** Save chart/report plaintext and input via the existing AES-GCM Prisma extension. */
export async function persistReading(
  userId: string,
  req: ReadingRequest,
  now: string,
  id?: string,
  profile?: { id: string; version: number },
  syncChecks: SqlStatement[] = [],
  title?: string | null,
  syncAfter: SqlStatement[] = [],
) {
  const generated = await generateReading(
    { ...req, locale: req.locale === 'en' ? 'en' : 'zh' },
    now,
    userId,
  );
  const tx = getDb();
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } });
  const plan = user.plan;
  const statements = [
    ...syncChecks,
    ...guard('EXISTS (SELECT 1 FROM "User" WHERE id=? AND "deletedAt" IS NULL)', userId),
  ];
  for (const profileId of [profile?.id, req.partnerProfileId]) {
    if (!profileId) continue;
    if (
      !(await tx.birthProfile.findFirst({
        where: { id: profileId, userId, isCurrent: true },
        select: { id: true },
      }))
    )
      throw new ApiError('E_PROFILE_REQUIRED', 'Profile was removed', 400);
    statements.push(
      ...guard(
        'EXISTS (SELECT 1 FROM "BirthProfile" WHERE id=? AND "userId"=? AND "isCurrent"=1)',
        profileId,
        userId,
      ),
    );
  }
  const row = { id: id ?? randomUUID() };
  statements.push(
    insertRow('Reading', {
      id: row.id,
      // DESIGN-GAP: Offline mobile imports retain their original generation time so synchronized history and engine time remain consistent.
      createdAt: syncChecks.length ? new Date(now) : undefined,
      title,
      userId,
      profileId: profile?.id,
      partnerProfileId: req.partnerProfileId,
      profileVersion: profile?.version,
      system: req.system,
      encInput: JSON.stringify(req),
      chart: json(generated.chart),
      schoolUsed: json(generated.meta.schoolUsed),
      engineVersion: generated.report.engineVersion,
      interpretVersion: generated.report.interpretVersion,
      knowledgeVersion: generated.report.knowledgeVersion,
      ...(req.locale !== 'en'
        ? { reportZh: json(generated.report) }
        : { reportEn: json(generated.report) }),
    }),
  );
  // DESIGN-GAP: Retention is decided inside the same D1 batch from current plan and ordered history.
  statements.push(
    statement(
      `DELETE FROM "Reading" WHERE "userId"=? AND "isPublic"=0 AND id IN
    (SELECT id FROM "Reading" WHERE "userId"=? ORDER BY "createdAt" DESC,id DESC LIMIT -1 OFFSET 50)
    AND EXISTS (SELECT 1 FROM "User" WHERE id=? AND plan='free')`,
      userId,
      userId,
      userId,
    ),
  );
  await atomicBatch([...statements, ...syncAfter]);
  await recordEvent('reading.created', { userId, system: req.system, locale: req.locale, plan });
  return { readingId: row.id, ...generated, report: localizeReport(generated.report, req.locale) };
}
/** Expand the current encrypted profile when a signed-in request omits birth. */
export async function resolveBirth(req: ReadingRequest, userId?: string) {
  if (!['bazi', 'ziwei', 'astrology', 'vedic', 'numerology', 'synastry'].includes(req.system))
    return {
      req,
      profile: userId
        ? req.profileId
          ? await ownedProfile(userId, req.profileId)
          : ((await currentProfile(userId)) ?? undefined)
        : undefined,
    };
  if (!userId) {
    if (!req.birth || (req.system === 'synastry' && !req.partnerBirth))
      throw new ApiError('E_PROFILE_REQUIRED', 'Birth input required', 400);
    return { req };
  }
  const profile = req.profileId
    ? await ownedProfile(userId, req.profileId)
    : await currentProfile(userId);
  if (!profile && !req.birth) throw new ApiError('E_PROFILE_REQUIRED', 'Profile required', 400);
  // Explicit form birth is a trial snapshot; still associate it with the selected profile for history.
  const birth = req.birth ?? (profile ? profileBirth(profile) : undefined);
  if (req.system !== 'synastry')
    return { req: { ...req, birth, profileId: profile?.id }, profile: profile ?? undefined };
  if (profile?.id && profile.id === req.partnerProfileId)
    throw new ApiError('E_VALIDATION', 'Two distinct profiles required', 400);
  const partner = req.partnerProfileId ? await ownedProfile(userId, req.partnerProfileId) : null;
  const partnerBirth = partner ? profileBirth(partner) : req.partnerBirth;
  if (!partnerBirth) throw new ApiError('E_PROFILE_REQUIRED', 'Second profile required', 400);
  return {
    req: {
      ...req,
      birth,
      partnerBirth,
      profileId: profile?.id,
      partnerProfileVersion: partner?.version,
    },
    profile: profile ?? undefined,
  };
}
/** Cache only hashes, a timestamp and the persisted ID; no anonymous PII enters D1 idempotency state. */
export async function idempotentCreate(
  req: ReadingRequest,
  identity: string,
  userId?: string,
  profile?: { id: string; version: number },
) {
  const key = `reading:idempotency:${digest(identity + ':' + req.idempotencyKey)}`;
  const fingerprint = digest(JSON.stringify(req));
  const token = randomUUID();
  const locked = await stateReserve(key + ':lock', token, 30);
  if (!locked) throw new ApiError('E_CONFLICT', 'Request is already in progress', 409);
  try {
    const raw = await stateRead(key);
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
    if (!userId)
      await recordEvent('reading.created', {
        system: req.system,
        locale: req.locale,
        plan: 'free',
      });
    const record = {
      fingerprint,
      now,
      ...('readingId' in result ? { readingId: result.readingId } : {}),
    };
    await stateWrite(key, JSON.stringify(record), 600);
    return result;
  } finally {
    await stateRelease(key + ':lock', token);
  }
}
export { actionError } from './api-error';
export { json, digest };
