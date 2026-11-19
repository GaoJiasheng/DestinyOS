'use server';
import { ownerFeaturePlan } from '@/lib/membership';
import {
  idSchema,
  userId,
  run,
  guardAge,
  limitReadingWork,
  blockAge,
} from '@/lib/reading-action-context';
import { listReadingHistory } from '@/lib/reading-history';
import { getCopy } from '@/i18n/get-copy';
import { currentProfile, profileBirth, removeProfile } from '@/lib/profile-service';
import { requestIp } from '@/lib/request-ip';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { recordEvent } from '@/lib/events';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/api-error';
import { assertRateLimit, ratelimit } from '@/lib/ratelimit';
import {
  ReadingRequestSchema,
  ReadingMetaSchema,
  parseReadingChart,
  type ReadingView,
  type ActionResult,
} from '@/lib/reading-schema';
import {
  generateReading,
  resolveBirth,
  idempotentCreate,
  readingView,
  json,
  checkRequestAge,
} from '@/lib/reading-service';
import { interpret, localizeReport } from '@tianji/interpret';
import { loadKnowledge } from '@/lib/knowledge';
import { BirthInputSchema, System } from '@tianji/shared';
import { ENGINE_VERSION } from '@tianji/engine/version';
import { stripPII } from '@/lib/strip-pii';
import {
  ReadingIntentSchema,
  adoptSelfProfile,
  saveCurrentProfile,
} from '@/lib/reading-profile-intent';
import { importAnonymousBatch } from '@/lib/reading-import';
import { randomUUID } from 'node:crypto';
import { emphasisEnabled } from '@/lib/emphasis';
import { siblingEmphasis, syncedSibling } from '@/lib/emphasis-schema';
/** Validate, normalize, compute and interpret; authenticated results are persisted, anonymous results are returned only. */
export async function createReadingAction(raw: unknown, rawIntent?: unknown) {
  return run(async () => {
    await guardAge();
    const req = ReadingRequestSchema.parse(raw);
    const intent = ReadingIntentSchema.parse(rawIntent);
    checkRequestAge(req);
    const session = await auth();
    const id = session?.user.id;
    const ip = requestIp(await headers());
    const resolved = await resolveBirth(req, id);
    checkRequestAge(resolved.req);
    assertRateLimit(
      await ratelimit(
        id
          ? ownerFeaturePlan(session.user.plan) === 'pro'
            ? 'reading.pro'
            : 'reading.free'
          : 'reading.anon',
        id ?? ip,
      ),
    );
    try {
      const profile = id
        ? await adoptSelfProfile(resolved.req, id, resolved.profile, intent)
        : undefined;
      const request =
        profile && !resolved.req.profileId
          ? { ...resolved.req, profileId: profile.id }
          : resolved.req;
      const owned = profile ?? resolved.profile;
      return await idempotentCreate(request, id ?? ip, id, owned, emphasisEnabled());
    } catch (error) {
      await recordEvent('reading.failed', {
        userId: id,
        system: req.system,
        locale: req.locale,
        plan: session?.user.plan ?? 'free',
      });
      throw error;
    }
  });
}
/** Read owner-only snapshots; public tokens use a separate privacy projection. */
export async function getReadingAction(
  raw: string,
  locale: 'zh' | 'en' | 'zh-TW' = 'zh',
): Promise<ActionResult<ReadingView>> {
  return run(async () => {
    const id = idSchema.parse(raw);
    const lang = z.enum(['zh', 'en', 'zh-TW']).parse(locale);
    const session = await auth();
    if (!session?.user.id) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    // DESIGN-GAP: Missing and foreign IDs use the same response; authorization precedes decryption.
    const row = await getDb().reading.findFirst({ where: { id, userId: session.user.id } });
    if (!row) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    // DESIGN-GAP: Public reports are served through token projections; isPublic must not bypass revealLevel.
    return readingView(row, lang, true);
  });
}
/** Paginate owner-only history, excluding encrypted inputs and full chart/report payloads. */
export async function listReadingsAction(raw: unknown = { limit: 20 }) {
  return listReadingHistory(raw);
}
/** Rename an owner reading, using a bounded title that the UI asks to keep free of personal information. */
export async function renameReadingAction(raw: string, title: string) {
  return run(async () => {
    const owner = await userId();
    const id = idSchema.parse(raw);
    const name = z.string().trim().min(1).max(120).parse(title);
    const result = await getDb().reading.updateMany({
      where: { id, userId: owner },
      data: { title: name },
    });
    if (!result.count) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    return { id, title: name };
  });
}
/** Delete an owner reading and cascading shares/feedback after client confirmation. */
export async function deleteReadingAction(raw: string) {
  return run(async () => {
    const owner = await userId();
    const id = idSchema.parse(raw);
    const result = await getDb().reading.deleteMany({ where: { id, userId: owner } });
    if (!result.count) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    return { id };
  });
}
/** Reinterpret the saved chart using the current knowledge release without recomputing the chart. */
export async function regenerateReportAction(raw: string, locale: 'zh' | 'en' | 'zh-TW') {
  return run(async () => {
    const owner = await userId();
    const id = idSchema.parse(raw);
    const lang = z.enum(['zh', 'en', 'zh-TW']).parse(locale);
    const row = await getDb().reading.findFirst({ where: { id, userId: owner } });
    if (!row) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    await limitReadingWork();
    const snapshot = ReadingRequestSchema.parse(JSON.parse(row.encInput));
    const report = interpret({
      system: row.system,
      chart: row.chart,
      locale: lang === 'en' ? 'en' : 'zh',
      knowledge: await loadKnowledge(row.system, lang),
      context: {
        now: row.createdAt.toISOString(),
        profileHasTime: !snapshot.birth?.timeUnknown,
        engineVersion: row.engineVersion,
        userId: owner,
      },
      options: { emphasis: emphasisEnabled() },
    });
    // The other locale keeps its text but takes the new emphasis, so both languages show one result.
    const sibling = syncedSibling(
      lang !== 'en' ? row.reportEn : row.reportZh,
      report.headline.emphasis,
    );
    await getDb().reading.update({
      where: { id, userId: owner },
      data: {
        [lang !== 'en' ? 'reportZh' : 'reportEn']: json(report),
        ...(sibling ? { [lang !== 'en' ? 'reportEn' : 'reportZh']: json(sibling) } : {}),
        knowledgeVersion: report.knowledgeVersion,
        interpretVersion: report.interpretVersion,
      },
    });
    return localizeReport(report, lang);
  });
}
/** Return the current decrypted birth profile to its owner. */
export async function getProfileAction() {
  return run(async () => {
    const owner = await userId();
    const row = await currentProfile(owner);
    return row
      ? {
          ...profileBirth(row),
          profileId: row.id,
          label: row.label ?? row.encName ?? '',
          relation: row.relation,
          version: row.version,
          displayName: row.encName ?? '',
        }
      : null;
  });
}
/** Save a new encrypted profile version atomically; `expectedProfileId` refuses a changed selection. */
export async function upsertProfileAction(
  raw: unknown,
  displayName = '',
  locale: 'zh' | 'en' | 'zh-TW' = 'zh',
  expectedProfileId?: string,
) {
  return run(async () => {
    await guardAge();
    const birth = BirthInputSchema.parse(raw);
    const lang = z.enum(['zh', 'en', 'zh-TW']).parse(locale);
    const name = z.string().trim().max(80).parse(displayName);
    // The age rule follows the edited profile's relation, so it is enforced inside saveProfile.
    const expected = idSchema.optional().parse(expectedProfileId);
    return saveCurrentProfile(await userId(), birth, name, lang, expected);
  });
}
/** Delete all owner profile versions and associated readings. */
export async function deleteProfileAction() {
  return run(async () => {
    const owner = await userId();
    const profile = await currentProfile(owner);
    if (profile) await removeProfile(owner, profile.id);
    return { deleted: true };
  });
}
/** Import one batch of device snapshots; damaged items are skipped, and owner-scoped IDs make retries safe. */
export async function importAnonymousDataAction(raw: unknown) {
  return run(async () => {
    await guardAge();
    const owner = await userId();
    // DESIGN-GAP: Imports re-run trusted computation outside the hourly reading quota; lib/reading-import keeps its own ceiling.
    const result = await importAnonymousBatch(owner, raw, async () => {
      const t = await getCopy();
      return { self: t('profiles.relation.self'), other: t('profiles.relation.other') };
    });
    (await cookies()).delete('anon_import');
    return result;
  });
}
/** Re-run a stale owner reading with its profiles' current birth facts; the old snapshot is kept. */
export async function rerunWithCurrentProfileAction(raw: string, locale: 'zh' | 'en' | 'zh-TW') {
  const prepared = await run(async () => {
    const owner = await userId();
    const row = await getDb().reading.findFirst({
      where: { id: idSchema.parse(raw), userId: owner },
      select: { system: true, profileId: true, partnerProfileId: true },
    });
    if (!row) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    if (!row.profileId) throw new ApiError('E_PROFILE_REQUIRED', 'Profile required', 400);
    return row;
  });
  if (!prepared.ok) return prepared;
  const { system, profileId, partnerProfileId } = prepared.data;
  return createReadingAction({
    system,
    locale: z.enum(['zh', 'en', 'zh-TW']).parse(locale),
    profileId,
    ...(partnerProfileId ? { partnerProfileId } : {}),
    idempotencyKey: randomUUID(),
  });
}
/** Persist bounded per-section votes; anonymous feedback is restricted to votes without text. */
export async function submitFeedbackAction(raw: unknown) {
  return run(async () => {
    const input = z
      .object({
        readingId: idSchema.optional(),
        unitId: z.string().max(200).optional(),
        sectionKey: z.string().max(100).optional(),
        vote: z.union([z.literal(1), z.literal(-1)]),
        text: z.string().max(500).optional(),
      })
      .strict()
      .parse(raw);
    const session = await auth();
    if (input.text && !session?.user.id)
      throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
    if (input.readingId) {
      const row = await getDb().reading.findFirst({
        where: {
          id: input.readingId,
          userId: session?.user.id ?? '',
        },
      });
      if (!row) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    }
    const ip = requestIp(await headers());
    assertRateLimit(await ratelimit('feedback', session?.user.id ?? ip));
    await getDb().feedback.create({ data: { ...input, userId: session?.user.id } });
    return { saved: true };
  });
}
/** Translate a validated anonymous chart without recomputing it or storing anonymous input. */
export async function translateAnonymousReportAction(raw: unknown, locale: 'zh' | 'en' | 'zh-TW') {
  return run(async () => {
    await guardAge();
    const lang = z.enum(['zh', 'en', 'zh-TW']).parse(locale);
    const input = z
      .object({
        system: z.nativeEnum(System),
        chart: z.unknown(),
        meta: z.unknown(),
        createdAt: z.string().datetime(),
        request: ReadingRequestSchema,
        report: z.unknown().optional(),
        regenerate: z.boolean().optional(),
      })
      .parse(raw);
    checkRequestAge(input.request);
    const chart = parseReadingChart(input.system, stripPII(input.chart));
    ReadingMetaSchema.parse(input.meta);
    await limitReadingWork();
    const report = interpret({
      system: input.system,
      chart,
      locale: lang,
      knowledge: await loadKnowledge(input.system, lang),
      context: {
        now: input.createdAt,
        profileHasTime: !input.request.birth?.timeUnknown,
        engineVersion: ENGINE_VERSION,
      },
      options: { emphasis: Boolean(input.regenerate) && emphasisEnabled() },
    });
    // A plain translation keeps the device's stored emphasis; only "regenerate" recomputes it.
    return input.regenerate ? report : siblingEmphasis(report, input.report);
  });
}
/** Set the session age gate before anonymous client data can be created. */
export async function blockAgeAction() {
  await blockAge();
}
/** Reveal the encrypted birth snapshot only to its owner after an explicit expand interaction. */
export async function getReadingBirthAction(raw: string) {
  return run(async () => {
    const owner = await userId();
    const id = idSchema.parse(raw);
    const row = await getDb().reading.findFirst({
      where: { id, userId: owner },
      select: { encInput: true },
    });
    if (!row) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    return ReadingRequestSchema.parse(JSON.parse(row.encInput)).birth ?? null;
  });
}

/** Preview a different natal house system with matching interpretation; saved snapshots remain immutable. */
export async function previewAstrologyHousesAction(raw: unknown) {
  return run(async () => {
    await guardAge();
    const input = z
      .object({
        readingId: idSchema.optional(),
        request: ReadingRequestSchema.optional(),
        createdAt: z.string().datetime().optional(),
        locale: z.enum(['zh', 'en', 'zh-TW']),
        houseSystem: z.enum(['placidus', 'whole_sign', 'equal']),
      })
      .strict()
      .refine((value) => Boolean(value.readingId) !== Boolean(value.request))
      .parse(raw);
    const session = await auth();
    let request = input.request;
    let now = input.createdAt;
    if (input.readingId) {
      if (!session?.user.id) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
      const row = await getDb().reading.findFirst({
        where: { id: input.readingId, userId: session.user.id },
      });
      if (!row) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
      if (row.userId !== session?.user.id)
        throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
      request = ReadingRequestSchema.parse(JSON.parse(row.encInput));
      now = row.createdAt.toISOString();
    }
    if (!request?.birth || request.system !== 'astrology' || !now)
      throw new ApiError('E_INVALID_INPUT', 'Natal birth snapshot required', 400);
    checkRequestAge(request);
    const ip = requestIp(await headers());
    assertRateLimit(
      await ratelimit(
        session?.user.id
          ? ownerFeaturePlan(session.user.plan) === 'pro'
            ? 'reading.pro'
            : 'reading.free'
          : 'reading.anon',
        session?.user.id ?? ip,
      ),
    );
    // DESIGN-GAP: House switching is a read-only preview, with chart/report/meta changed together; no new reading is persisted.
    const generated = await generateReading(
      {
        ...request,
        locale: input.locale,
        options: {
          ...request.options,
          school: { ...request.options?.school, houseSystem: input.houseSystem },
        },
      },
      now,
    );
    return { chart: generated.chart, report: generated.report, meta: generated.meta };
  });
}
