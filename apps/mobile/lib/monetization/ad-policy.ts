import { normalizeBirth } from '@tianji/engine/common';
import type { Profile } from '../data/models';
export type AdAge = 'blocked' | 'teen' | 'adult' | 'unknown';
/** Compute only a category on device. No raw birth data, exact age, profile IDs or account IDs reach ads. */
export function adAge(
  profiles: readonly { data: Profile | null }[],
  blocked: boolean,
  today = new Date(),
): AdAge {
  if (blocked) return 'blocked';
  // DESIGN-GAP: Multi-profile households use the most restrictive age across self/legacy profiles;
  // family/friend charts cannot redefine the device user's age. Unknown age defaults to non-personalized teen treatment.
  const self = profiles.filter(({ data }) => data && (!data.relation || data.relation === 'self'));
  if (!self.length) return 'unknown';
  let teen = false;
  for (const { data } of self) {
    if (!data) continue;
    const { local } = normalizeBirth(data.birth, 'zh');
    const age =
      today.getUTCFullYear() -
      local.year -
      Number(
        today.getUTCMonth() + 1 < local.month ||
          (today.getUTCMonth() + 1 === local.month && today.getUTCDate() < local.day),
      );
    if (age < 13) return 'blocked';
    if (age < 18) teen = true;
  }
  return teen ? 'teen' : 'adult';
}
/** Fixed independent containers only: Today one, reports between chapters 2/3 and 6/7. */
export function reportAdSlot(index: number, length: number): 0 | 1 | null {
  return index === 1 && length > 2 ? 0 : index === 5 && length > 6 ? 1 : null;
}
