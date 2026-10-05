import { resourceText, resourceNames } from './platform/resources';
import { compute, normalizeBirth } from '@tianji/engine';
import { BirthInputSchema, type System } from '@tianji/shared';
import type { KnowledgeBundle } from '@tianji/content';
import { calculateDaily } from './daily-compute';
export const fixtures = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export const fixtureNow = '2026-10-04T00:00:00Z';
/** Produce deterministic A–G report charts from the repository's documented golden births. */
export async function fixtureChart(
  system: System,
  fixture: (typeof fixtures)[number],
  knowledge: KnowledgeBundle,
) {
  const birth = BirthInputSchema.parse(
    JSON.parse(await resourceText(`../../packages/engine/test/fixtures/birth/${fixture}.json`)),
  );
  if (system === 'daily')
    return calculateDaily(
      birth,
      '2026-10-04',
      birth.place?.tz ?? 'UTC',
      `fixture-${fixture}`,
      'zh',
      knowledge,
    ).chart;
  // DESIGN-GAP: Divination A–G previews use fixed casts/time/place and fixture-specific deterministic seeds, never live time.
  if (system === 'iching')
    return JSON.parse(
      await resourceText(`../../packages/content/test/fixtures/iching.${fixture}.json`),
    ) as unknown;
  return compute({
    system,
    birth: normalizeBirth(birth),
    now: fixtureNow,
    seed: `fixture-${fixture}`,
    ...(system === 'tarot' ? { spread: 'celtic_cross' as const } : {}),
    ...(system === 'qimen'
      ? {
          question: {
            at: `${fixtureNow}[UTC]`,
            place: { lng: birth.place?.lng ?? 0, tz: birth.place?.tz ?? 'UTC' },
            category: 'general',
          },
        }
      : {}),
  }).chart;
}
let sourceFixtures: Promise<Record<string, unknown[]>> | undefined;
/** Reuse the exact frozen chart corpus used by CI's path validation. */
export function validationFixtures() {
  return (sourceFixtures ??= (async () => {
    const directory = '../../packages/content/test/fixtures';
    const result: Record<string, unknown[]> = {};
    for (const file of await resourceNames(directory)) {
      if (!file.endsWith('.json')) continue;
      const system = file.split('.')[0]!;
      (result[system] ??= []).push(
        JSON.parse(await resourceText(`${directory}/${file}`)) as unknown,
      );
    }
    return result;
  })());
}
