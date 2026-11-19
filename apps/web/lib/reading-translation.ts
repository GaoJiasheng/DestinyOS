import type { Reading } from '@prisma/client';
import type { Locale, System } from '@tianji/shared';
import { siblingEmphasis } from './emphasis-schema';
/** Interpret a missing locale from the saved chart with the release it was made with. Chart emphasis
 * is copied from the sibling locale's stored report (or left out), never recomputed, so a language
 * switch only re-renders the saved bands. */
export async function missingTranslation(
  row: Reading,
  system: System,
  locale: Locale,
  profileHasTime: boolean,
) {
  const { interpret } = await import('@tianji/interpret');
  const { loadKnowledge } = await import('./knowledge');
  const report = interpret({
    system,
    chart: row.chart,
    locale: locale === 'en' ? 'en' : 'zh',
    knowledge: await loadKnowledge(system, locale, row.knowledgeVersion),
    context: {
      now: row.createdAt.toISOString(),
      profileHasTime,
      engineVersion: row.engineVersion,
      userId: row.userId ?? undefined,
    },
  });
  return siblingEmphasis(report, locale !== 'en' ? row.reportEn : row.reportZh);
}
