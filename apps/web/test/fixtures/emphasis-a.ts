import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import { computeZiwei, normalizeBirth } from '@tianji/engine';
import { BirthInputSchema } from '@tianji/shared';
import { ziweiEmphasis, type Emphasis } from '@tianji/interpret';
/** Fixture A (1990-05-15 08:30 Beijing, male) emphasis exactly as P1 computes it. */
export function fixtureEmphasis(): Emphasis {
  return ziweiEmphasis(
    computeZiwei({
      birth: normalizeBirth(BirthInputSchema.parse(A)),
      now: '2026-11-16T00:00:00Z',
    }),
  );
}
