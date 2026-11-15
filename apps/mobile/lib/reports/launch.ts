import { ENGINE_VERSION } from '@tianji/engine';
import { NumerologyNameSchema } from '@tianji/shared';
import { getLocalStore } from '../data/store';
import type { LocalRecord, Profile } from '../data/models';
import type { ReportSystem } from './readings';

/** Natal systems the Reading tab casts straight from a saved profile. */
export const natalSystems = ['bazi', 'ziwei', 'astrology', 'vedic', 'numerology'] as const;
export type NatalSystem = (typeof natalSystems)[number];
export function isNatalSystem(value: unknown): value is NatalSystem {
  return natalSystems.some((system) => system === value);
}

/** Tarot, I Ching and Qimen describe a draw or a cast, not a natal chart. */
export function isDivination(system: string): boolean {
  return system === 'tarot' || system === 'iching' || system === 'qimen';
}

/** Profile display names are free text; numerology only accepts a Latin-letter name. */
export function numerologyName(name: string | undefined | null): string | undefined {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return undefined;
  return NumerologyNameSchema.safeParse(trimmed).success ? trimmed : undefined;
}

/** Let the busy indicator paint before the synchronous engine work blocks the JS thread. */
export function yieldFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

// Bounded scan: history is newest-first, so a matching report is almost always near the top.
const LOOKUP_LIMIT = 500;

/** Newest saved report for the same profile version, system, engine and numerology name. */
export async function findExistingReading(
  system: ReportSystem,
  profile: LocalRecord<Profile>,
  name?: string,
): Promise<string | null> {
  if (!profile.data) return null;
  const store = await getLocalStore();
  const list = await store.readings.list(LOOKUP_LIMIT);
  const match = list.find(
    (record) =>
      record.data?.system === system &&
      record.data.status === 'ok' &&
      record.data.profileId === profile.id &&
      record.data.profileVersion === profile.data?.version &&
      record.data.engineVersion === ENGINE_VERSION &&
      !record.data.inputSnapshot.partnerProfileId &&
      (system !== 'numerology' || (record.data.inputSnapshot.name || undefined) === name),
  );
  return match?.id ?? null;
}
