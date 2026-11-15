import type { MessageKey } from '@/i18n/catalog';
import { BirthInputSchema, type BirthInput, type Locale, type System } from '@tianji/shared';
import { createReadingAction, upsertProfileAction } from '@/app/readings/actions';
import { updateAnonymous } from './anonymous-storage';
import type { LocalReading, ReadingRequest } from './reading-schema';
export type SubmitOutcome = { href: string } | { error: string } | { ageRestricted: true };
/** A rejected server-action call means the request never completed (offline, timeout, deploy skew). */
export const networkError = 'form.birth.error.network';
export const storageError = 'report.storageError';
/** Save the profile from the dedicated editor; network and device-storage failures are reported separately. */
export async function saveBirthProfile(
  birth: BirthInput,
  name: string,
  locale: Locale,
  signedIn: boolean,
): Promise<{ ok: true } | { error: string }> {
  const parsed = BirthInputSchema.parse(birth);
  if (signedIn) {
    let saved: Awaited<ReturnType<typeof upsertProfileAction>>;
    try {
      saved = await upsertProfileAction(parsed, name, locale);
    } catch {
      return { error: networkError };
    }
    return saved.ok ? { ok: true } : { error: `report.error.${saved.error.code}` };
  }
  try {
    await updateAnonymous((data) => ({ ...data, profile: parsed, displayName: name }));
    return { ok: true };
  } catch {
    return { error: storageError };
  }
}
/** Create a reading; a guest result is stored locally and only replaces the device profile when it describes the user. */
export async function createBirthReading({
  system,
  birth,
  name,
  locale,
  school,
  idempotencyKey,
  writeProfile,
}: {
  system: Exclude<System, 'daily'>;
  birth: BirthInput;
  name: string;
  locale: Locale;
  school?: Record<string, string | number | boolean>;
  idempotencyKey: string;
  writeProfile: boolean;
}): Promise<SubmitOutcome> {
  const began = performance.now();
  const req: ReadingRequest = {
    system,
    birth: BirthInputSchema.parse(birth),
    locale,
    displayName: name,
    options: school ? { school } : undefined,
    idempotencyKey,
  };
  let result: Awaited<ReturnType<typeof createReadingAction>>;
  try {
    result = await createReadingAction(req);
  } catch {
    return { error: networkError };
  }
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, 1200 - (performance.now() - began))),
  );
  if (!result.ok)
    return result.error.code === 'E_AGE_RESTRICTED'
      ? { ageRestricted: true }
      : { error: `report.error.${result.error.code}` };
  if ('readingId' in result.data && result.data.readingId)
    return { href: `/${system}/r/${result.data.readingId}` };
  const local: LocalReading = {
    id: crypto.randomUUID(),
    system,
    createdAt: new Date().toISOString(),
    title: null,
    request: req,
    ...result.data,
  };
  try {
    await updateAnonymous((data) => ({
      ...data,
      ...(writeProfile ? { profile: req.birth, displayName: name } : {}),
      readings: [local, ...data.readings].slice(0, 50),
    }));
  } catch {
    return { error: storageError };
  }
  return { href: `/${system}/r/local/${local.id}` };
}
export type School = { solar: boolean; ziHour: string; house: string; leap: string };
export const defaultSchool: School = {
  solar: true,
  ziHour: 'zi_unified',
  house: 'placidus',
  leap: 'split',
};
/** Shared advanced controls send only parameters supported by the chosen system's current engine. */
export function schoolOptions(
  system: Exclude<System, 'daily'>,
  { solar, ziHour, house, leap }: School,
): Record<string, string | number | boolean> | undefined {
  if (system === 'bazi') return { useApparentSolarTime: solar, ziHour };
  if (system === 'ziwei')
    return {
      useApparentSolarTime: solar,
      leapMonth: leap === 'split' ? 'split_by_15' : leap === 'current' ? 'as_prev' : 'as_next',
    };
  return system === 'astrology' ? { houseSystem: house } : undefined;
}
/** DESIGN-GAP: The encrypted device draft bridges routes for guests and signed-in users without putting birth facts in URLs. */
export async function saveRectificationDraft(birth: BirthInput, name: string) {
  const parsed = BirthInputSchema.safeParse(birth);
  await updateAnonymous((data) => ({
    ...data,
    settings: {
      ...data.settings,
      rectificationDraft: parsed.success ? { birth: parsed.data, displayName: name } : null,
    },
  }));
}
/** Primary button label for the current step and host. */
export function submitLabel({
  busy,
  step,
  embedded,
  profileMode,
  completionKey,
}: {
  busy: boolean;
  step: number;
  embedded: boolean;
  profileMode: boolean;
  completionKey?: MessageKey;
}): MessageKey {
  if (busy) return step === 1 ? 'common.loading' : 'form.birth.saving';
  if (step === 1) return 'form.birth.next';
  if (embedded) return completionKey ?? 'rectification.start';
  return profileMode ? 'form.birth.save' : 'form.birth.submit';
}
