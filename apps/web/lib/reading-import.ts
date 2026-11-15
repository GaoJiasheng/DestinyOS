import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BirthInputSchema, type BirthInput } from '@tianji/shared';
import { getDb } from './db';
import { ApiError, actionError } from './api-error';
import {
  ReadingMetaSchema,
  ReadingRequestSchema,
  parseReadingChart,
  type ReadingRequest,
} from './reading-schema';
import { checkAge, digest, persistReading } from './reading-service';
import { profileBirth, saveProfile } from './profile-service';
import { sameNatalBirth } from './birth-compare';
import { stripPII } from './strip-pii';
import { stateRead, stateRelease, stateReserve, stateWrite } from './state';
/** Readings per action call; the client sends a device snapshot in batches to show progress. */
export const IMPORT_BATCH_SIZE = 10;
// DESIGN-GAP: Imports have their own hourly ceiling instead of the reading quota; a full device holds at most 50 reports.
export const IMPORT_HOURLY_LIMIT = 200;
const windowSeconds = 3600;
export const ImportBatchSchema = z
  .object({
    anonId: z.string().uuid(),
    profile: BirthInputSchema.optional(),
    displayName: z.string().max(80).optional(),
    saveProfile: z.boolean().default(true),
    // Items are checked one by one so a single damaged snapshot cannot block the others.
    readings: z.array(z.unknown()).max(IMPORT_BATCH_SIZE),
  })
  .strict();
const LocalReadingSchema = z.object({
  id: z.string().uuid(),
  request: ReadingRequestSchema,
  chart: z.unknown(),
  meta: z.unknown(),
  createdAt: z.string().datetime(),
});
export type ImportItemResult =
  { status: 'imported' | 'existing'; readingId: string } | { status: 'failed'; code: string };
export type ProfileImportOutcome =
  'none' | 'created' | 'savedOther' | 'duplicate' | 'skipped' | 'limit' | 'failed';
type Valid = { index: number; id: string; request: ReadingRequest; createdAt: string };
function validate(raw: unknown, index: number): Valid | ImportItemResult {
  const parsed = LocalReadingSchema.safeParse(raw);
  if (!parsed.success) return { status: 'failed', code: 'E_VALIDATION' };
  try {
    parseReadingChart(parsed.data.request.system, stripPII(parsed.data.chart));
    ReadingMetaSchema.parse(parsed.data.meta);
  } catch {
    return { status: 'failed', code: 'E_VALIDATION' };
  }
  return {
    index,
    id: parsed.data.id,
    request: parsed.data.request,
    // A device clock ahead of the server must not place imports above newer readings.
    createdAt: new Date(Math.min(Date.parse(parsed.data.createdAt), Date.now())).toISOString(),
  };
}
async function importProfile(
  owner: string,
  birth: BirthInput,
  options: {
    save: boolean;
    displayName?: string;
    labels: () => Promise<{ self: string; other: string }>;
  },
): Promise<ProfileImportOutcome> {
  const existing = await getDb().birthProfile.findMany({
    where: { userId: owner, isCurrent: true },
  });
  const duplicate = existing.some((row) => {
    try {
      return sameNatalBirth(profileBirth(row), birth);
    } catch {
      return false;
    }
  });
  if (duplicate) return 'duplicate';
  if (!options.save) return 'skipped';
  // An account that already has profiles keeps them; the device person joins as "other".
  const relation = existing.length ? 'other' : 'self';
  const names = await options.labels();
  const label = options.displayName?.trim() || (relation === 'self' ? names.self : names.other);
  try {
    await saveProfile(owner, birth, { label, relation }, 'zh');
    return relation === 'self' ? 'created' : 'savedOther';
  } catch (error) {
    const code = actionError(error);
    if (code === 'E_AGE_RESTRICTED') throw error;
    return code === 'E_PROFILE_LIMIT' ? 'limit' : 'failed';
  }
}
const CounterSchema = z.object({ count: z.number().int().min(0), since: z.number() });
/** Import one batch of a device snapshot; each reading succeeds or fails on its own. */
export async function importAnonymousBatch(
  owner: string,
  raw: unknown,
  labels: () => Promise<{ self: string; other: string }>,
) {
  const input = ImportBatchSchema.parse(raw);
  const checked = input.readings.map(validate);
  const valid = checked.filter((item): item is Valid => 'request' in item);
  // Age limits stay strict: one under-age snapshot rejects the whole batch before any write.
  if (input.profile) checkAge(input.profile, 'zh');
  for (const item of valid) {
    if (item.request.birth) checkAge(item.request.birth, item.request.locale);
    if (item.request.partnerBirth) checkAge(item.request.partnerBirth, item.request.locale);
  }
  const results: ImportItemResult[] = checked.map((item) =>
    'request' in item ? { status: 'failed', code: 'E_INTERNAL' } : item,
  );
  if (!valid.length && !input.profile) return { results, profile: 'none' as const };
  const owned = digest(owner);
  const lock = `import:lock:${owned}`,
    token = randomUUID();
  // One import per account at a time keeps the counter below exact without a new rate-limit route.
  if (!(await stateReserve(lock, token, 120)))
    throw new ApiError('E_CONFLICT', 'Import already in progress', 409);
  try {
    const profile: ProfileImportOutcome = input.profile
      ? await importProfile(owner, input.profile, {
          save: input.saveProfile,
          displayName: input.displayName,
          labels,
        })
      : 'none';
    const counterKey = `import:count:${owned}`;
    const stored = await stateRead(counterKey);
    const prior = CounterSchema.safeParse(stored ? JSON.parse(stored) : null);
    const since =
      prior.success && prior.data.since > Date.now() - windowSeconds * 1000
        ? prior.data.since
        : Date.now();
    let used = prior.success && since === prior.data.since ? prior.data.count : 0;
    for (const item of valid) {
      const id = `r${digest(owner + ':' + input.anonId + ':' + item.id).slice(0, 30)}`;
      if (await getDb().reading.findFirst({ where: { id, userId: owner }, select: { id: true } })) {
        results[item.index] = { status: 'existing', readingId: id };
        continue;
      }
      if (used >= IMPORT_HOURLY_LIMIT) {
        results[item.index] = { status: 'failed', code: 'E_RATE_LIMITED' };
        continue;
      }
      try {
        used++;
        await persistReading(
          owner,
          item.request,
          item.createdAt,
          id,
          undefined,
          [],
          null,
          [],
          true,
        );
        results[item.index] = { status: 'imported', readingId: id };
      } catch (error) {
        results[item.index] = { status: 'failed', code: actionError(error) };
      }
    }
    const remaining = Math.max(1, Math.ceil((since + windowSeconds * 1000 - Date.now()) / 1000));
    await stateWrite(counterKey, JSON.stringify({ count: used, since }), remaining);
    if (results.some((r) => r.status !== 'failed'))
      await getDb().user.update({ where: { id: owner }, data: { anonId: input.anonId } });
    return { results, profile };
  } finally {
    await stateRelease(lock, token);
  }
}
