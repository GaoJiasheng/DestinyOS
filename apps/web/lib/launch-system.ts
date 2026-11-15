import { BirthInputSchema, type BirthInput, type Locale } from '@tianji/shared';
import {
  createReadingAction,
  getProfileAction,
  getReadingBirthAction,
  listReadingsAction,
} from '@/app/readings/actions';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import { ensureConsent } from '@/lib/consent';
import type { LocalReading } from './reading-schema';

export type LaunchSystem = 'bazi' | 'ziwei' | 'astrology' | 'vedic';
/** The birth profile a one-click reading would use; `profileId` is set only for an account profile. */
export type LaunchProfile = { birth: BirthInput; profileId?: string };
export type LaunchResult = { href: string } | { error: string } | { declined: true };

const birthKeys = [
  'calendar',
  'year',
  'month',
  'day',
  'isLeapMonth',
  'hour',
  'minute',
  'timeUnknown',
  'place',
  'gender',
  'timeSource',
  'rectificationConfidence',
] as const;
// Account history keeps form "trial" births under the selected profile, so only a few recent rows are compared.
const historyLookupLimit = 5;

function pickBirth(raw: object): BirthInput {
  return BirthInputSchema.parse(
    Object.fromEntries(
      Object.entries(raw).filter(([key]) => (birthKeys as readonly string[]).includes(key)),
    ),
  );
}

/** Compare the inputs that change a natal chart; display-only place names are ignored. */
export function sameBirth(a: BirthInput | null | undefined, b: BirthInput | null | undefined) {
  if (!a || !b) return false;
  const time = (value: BirthInput) => (value.timeUnknown ? null : [value.hour, value.minute]);
  const place = (value: BirthInput) =>
    value.place ? [value.place.lat, value.place.lng, value.place.tz] : null;
  return (
    a.calendar === b.calendar &&
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    Boolean(a.isLeapMonth) === Boolean(b.isLeapMonth) &&
    a.timeUnknown === b.timeUnknown &&
    JSON.stringify(time(a)) === JSON.stringify(time(b)) &&
    JSON.stringify(place(a)) === JSON.stringify(place(b)) &&
    a.gender === b.gender
  );
}

/** Resolve the account profile first, then the device profile; null sends the visitor to the form. */
export async function findLaunchProfile(): Promise<LaunchProfile | null> {
  const [local, saved] = await Promise.all([
    readAnonymous().catch(() => null),
    getProfileAction().catch(() => null),
  ]);
  if (saved?.ok && saved.data)
    return { birth: pickBirth(saved.data), profileId: saved.data.profileId };
  return local?.profile ? { birth: pickBirth(local.profile) } : null;
}

/** Most recent existing report for the same person and system, so a repeat tap reopens it. */
export async function findExistingReading(
  system: LaunchSystem,
  profile: LaunchProfile,
): Promise<string | null> {
  if (profile.profileId) {
    const list = await listReadingsAction({ system, limit: historyLookupLimit }).catch(() => null);
    if (!list?.ok) return null;
    for (const item of list.data.items) {
      const birth = await getReadingBirthAction(item.id).catch(() => null);
      if (birth?.ok && sameBirth(birth.data, profile.birth)) return `/${system}/r/${item.id}`;
    }
    return null;
  }
  const local = await readAnonymous().catch(() => null);
  const match = local?.readings
    .filter(
      (reading) => reading.system === system && sameBirth(reading.request.birth, profile.birth),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return match ? `/${system}/r/local/${match.id}` : null;
}

/** Reuse a saved birth profile for a one-click natal reading; absent profiles go to the documented form. */
export async function launchSystem(
  system: LaunchSystem,
  locale: Locale,
  known?: LaunchProfile | null,
): Promise<LaunchResult> {
  const profile = known === undefined ? await findLaunchProfile() : known;
  if (!profile) return { href: `/${system}/new` };
  const existing = await findExistingReading(system, profile);
  if (existing) return { href: existing };
  if (!(await ensureConsent())) return { declined: true };
  const request = {
    system,
    locale,
    ...(profile.profileId ? { profileId: profile.profileId } : {}),
    birth: profile.birth,
    idempotencyKey: crypto.randomUUID(),
  };
  const began = performance.now();
  const result = await createReadingAction(request);
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, 1200 - (performance.now() - began))),
  );
  if (!result.ok) return { error: result.error.code };
  if ('readingId' in result.data && result.data.readingId)
    return { href: `/${system}/r/${result.data.readingId}` };
  const reading: LocalReading = {
    id: crypto.randomUUID(),
    system,
    request,
    createdAt: new Date().toISOString(),
    title: null,
    ...result.data,
  };
  await updateAnonymous((data) => ({
    ...data,
    profile: data.profile ?? profile.birth,
    readings: [reading, ...data.readings].slice(0, 50),
  }));
  return { href: `/${system}/r/local/${reading.id}` };
}
