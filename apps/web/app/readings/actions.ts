'use server';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
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
  actionError,
  resolveBirth,
  idempotentCreate,
  readingView,
  persistReading,
  json,
  digest,
  checkAge,
} from '@/lib/reading-service';
import { interpret } from '@tianji/interpret';
import { loadKnowledge } from '@/lib/knowledge';
import { BirthInputSchema, System } from '@tianji/shared';
import { normalizeBirth, ENGINE_VERSION } from '@tianji/engine';
import { stripPII } from '@/lib/strip-pii';
const idSchema = z.string().min(1).max(100);
async function userId() {
  const session = await auth();
  if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  return session.user.id;
}
async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    const code = actionError(error);
    if (code === 'E_AGE_RESTRICTED')
      (await cookies()).set('age_gate', 'blocked', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    return { ok: false, error: { code } };
  }
}
async function guardAge() {
  if ((await cookies()).get('age_gate')?.value === 'blocked')
    throw new ApiError('E_AGE_RESTRICTED', 'Age restricted', 403);
}
/** Validate, normalize, compute and interpret; authenticated results are persisted, anonymous results are returned only. */
export async function createReadingAction(raw: unknown) {
  return run(async () => {
    await guardAge();
    const req = ReadingRequestSchema.parse(raw);
    if (req.birth) checkAge(req.birth, req.locale);
    const session = await auth();
    const id = session?.user.id;
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const resolved = await resolveBirth(req, id);
    if (resolved.req.birth) checkAge(resolved.req.birth, req.locale);
    assertRateLimit(
      await ratelimit(
        id ? (session.user.plan === 'pro' ? 'reading.pro' : 'reading.free') : 'reading.anon',
        id ?? ip,
      ),
    );
    return idempotentCreate(resolved.req, id ?? ip, id, resolved.profile);
  });
}
/** Read only owner/public snapshots; public callers never receive the private input snapshot. */
export async function getReadingAction(
  raw: string,
  locale: 'zh' | 'en' = 'zh',
): Promise<ActionResult<ReadingView>> {
  return run(async () => {
    const id = idSchema.parse(raw);
    const lang = z.enum(['zh', 'en']).parse(locale);
    const session = await auth();
    const row = await getDb().reading.findUnique({ where: { id } });
    if (!row) throw new ApiError('E_NOT_FOUND', 'Reading not found', 404);
    const owner = row.userId === session?.user.id;
    if (!owner && !row.isPublic) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    return readingView(row, lang, owner);
  });
}
/** Paginate owner-only history, excluding encrypted inputs and full chart/report payloads. */
export async function listReadingsAction(raw: unknown = { limit: 20 }) {
  return run(async () => {
    const owner = await userId();
    const input = z
      .object({
        system: z.nativeEnum(System).optional(),
        cursor: idSchema.optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .strict()
      .parse(raw);
    if (
      input.cursor &&
      !(await getDb().reading.findFirst({ where: { id: input.cursor, userId: owner } }))
    )
      throw new ApiError('E_NOT_FOUND', 'Cursor not found', 404);
    const rows = await getDb().reading.findMany({
      where: { userId: owner, system: input.system },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : 0,
      take: input.limit + 1,
      select: {
        id: true,
        title: true,
        system: true,
        createdAt: true,
        reportZh: true,
        reportEn: true,
      },
    });
    const more = rows.length > input.limit;
    const visible = rows.slice(0, input.limit);
    return {
      items: visible.map((row) => ({
        id: row.id,
        title: row.title,
        system: row.system,
        createdAt: row.createdAt.toISOString(),
        keywords:
          (row.reportZh ?? row.reportEn) && typeof (row.reportZh ?? row.reportEn) === 'object'
            ? (((row.reportZh ?? row.reportEn) as { headline?: { keywords?: string[] } }).headline
                ?.keywords ?? [])
            : [],
      })),
      nextCursor: more ? visible.at(-1)?.id : null,
    };
  });
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
export async function regenerateReportAction(raw: string, locale: 'zh' | 'en') {
  return run(async () => {
    const owner = await userId();
    const id = idSchema.parse(raw);
    const lang = z.enum(['zh', 'en']).parse(locale);
    const row = await getDb().reading.findFirst({ where: { id, userId: owner } });
    if (!row) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    const snapshot = ReadingRequestSchema.parse(JSON.parse(row.encInput));
    const report = interpret({
      system: row.system,
      chart: row.chart,
      locale: lang,
      knowledge: await loadKnowledge(row.system, lang),
      context: {
        now: row.createdAt.toISOString(),
        profileHasTime: !snapshot.birth?.timeUnknown,
        engineVersion: row.engineVersion,
        userId: owner,
      },
    });
    await getDb().reading.update({
      where: { id, userId: owner },
      data: {
        [lang === 'zh' ? 'reportZh' : 'reportEn']: json(report),
        knowledgeVersion: report.knowledgeVersion,
        interpretVersion: report.interpretVersion,
      },
    });
    return report;
  });
}
/** Return the current decrypted birth profile to its owner. */
export async function getProfileAction() {
  return run(async () => {
    const owner = await userId();
    const row = await getDb().birthProfile.findFirst({ where: { userId: owner, isCurrent: true } });
    return row
      ? {
          ...BirthInputSchema.parse({
            ...JSON.parse(row.encBirth),
            place: row.encPlace ? JSON.parse(row.encPlace) : undefined,
            gender: row.gender,
          }),
          version: row.version,
          displayName: row.encName ?? '',
        }
      : null;
  });
}
/** Save a new encrypted profile version atomically, retaining earlier versions. */
export async function upsertProfileAction(
  raw: unknown,
  displayName = '',
  locale: 'zh' | 'en' = 'zh',
) {
  return run(async () => {
    await guardAge();
    const birth = BirthInputSchema.parse(raw);
    const lang = z.enum(['zh', 'en']).parse(locale);
    const name = z.string().trim().max(80).parse(displayName);
    checkAge(birth, lang);
    const normalized = normalizeBirth(birth, lang);
    const owner = await userId();
    const { place, gender, ...input } = birth;
    const row = await getDb().$transaction(
      async (tx) => {
        const last = await tx.birthProfile.findFirst({
          where: { userId: owner },
          orderBy: { version: 'desc' },
        });
        await tx.birthProfile.updateMany({
          where: { userId: owner, isCurrent: true },
          data: { isCurrent: false },
        });
        return tx.birthProfile.create({
          data: {
            userId: owner,
            version: (last?.version ?? 0) + 1,
            encBirth: JSON.stringify(input),
            encPlace: place ? JSON.stringify(place) : null,
            encName: name || null,
            gender,
            timeUnknown: normalized.timeUnknown,
            tz: normalized.local.tz,
            birthYear: normalized.local.year,
            chartHash: digest(JSON.stringify(normalized)),
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return { profileId: row.id, version: row.version, warnings: normalized.warnings };
  });
}
/** Delete all owner profile versions and associated readings. */
export async function deleteProfileAction() {
  return run(async () => {
    const owner = await userId();
    await getDb().$transaction(async (tx) => {
      await tx.reading.deleteMany({ where: { userId: owner, profileId: { not: null } } });
      await tx.birthProfile.deleteMany({ where: { userId: owner } });
    });
    return { deleted: true };
  });
}
/** Import at most 50 local snapshots, validating charts and recomputing trusted content; owner-scoped IDs make retries safe. */
export async function importAnonymousDataAction(raw: unknown) {
  return run(async () => {
    await guardAge();
    const owner = await userId();
    const input = z
      .object({
        anonId: z.string().uuid(),
        profile: BirthInputSchema.optional(),
        displayName: z.string().max(80).optional(),
        readings: z
          .array(
            z.object({
              id: z.string().uuid(),
              request: ReadingRequestSchema,
              chart: z.unknown(),
              meta: z.unknown(),
              createdAt: z.string().datetime(),
            }),
          )
          .max(50),
      })
      .parse(raw);
    if (input.profile) checkAge(input.profile, 'zh');
    for (const local of input.readings) {
      if (local.request.birth) checkAge(local.request.birth, local.request.locale);
      parseReadingChart(local.request.system, stripPII(local.chart));
      ReadingMetaSchema.parse(local.meta);
    }
    if (input.profile) {
      const hasProfile = await getDb().birthProfile.findFirst({
        where: { userId: owner, isCurrent: true },
      });
      if (!hasProfile) {
        const saved = await upsertProfileAction(input.profile, input.displayName);
        if (!saved.ok) throw new ApiError(saved.error.code, 'Profile import failed', 400);
      }
    }
    const ids: string[] = [];
    for (const local of input.readings) {
      const id = `r${digest(owner + ':' + input.anonId + ':' + local.id).slice(0, 30)}`;
      const exists = await getDb().reading.findFirst({ where: { id, userId: owner } });
      if (!exists) await persistReading(owner, local.request, local.createdAt, id);
      ids.push(id);
    }
    await getDb().user.update({ where: { id: owner }, data: { anonId: input.anonId } });
    (await cookies()).delete('anon_import');
    return { readingIds: ids };
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
          OR: [{ userId: session?.user.id ?? '' }, { isPublic: true }],
        },
      });
      if (!row) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
    }
    const ip = (await headers()).get('x-forwarded-for') || 'unknown';
    assertRateLimit(await ratelimit('feedback', session?.user.id ?? ip));
    await getDb().feedback.create({ data: { ...input, userId: session?.user.id } });
    return { saved: true };
  });
}
/** Translate a validated anonymous chart without recomputing it or storing anonymous input. */
export async function translateAnonymousReportAction(raw: unknown, locale: 'zh' | 'en') {
  return run(async () => {
    await guardAge();
    const lang = z.enum(['zh', 'en']).parse(locale);
    const input = z
      .object({
        system: z.nativeEnum(System),
        chart: z.unknown(),
        meta: z.unknown(),
        createdAt: z.string().datetime(),
        request: ReadingRequestSchema,
      })
      .parse(raw);
    if (input.request.birth) checkAge(input.request.birth, lang);
    const chart = parseReadingChart(input.system, stripPII(input.chart));
    ReadingMetaSchema.parse(input.meta);
    return interpret({
      system: input.system,
      chart,
      locale: lang,
      knowledge: await loadKnowledge(input.system, lang),
      context: {
        now: input.createdAt,
        profileHasTime: !input.request.birth?.timeUnknown,
        engineVersion: ENGINE_VERSION,
      },
    });
  });
}
/** Set the session age gate before anonymous client data can be created. */
export async function blockAgeAction() {
  (await cookies()).set('age_gate', 'blocked', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
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
