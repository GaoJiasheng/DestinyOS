import type { DailyChart } from '@tianji/shared';

export type DailyDimension = 'career' | 'wealth' | 'love' | 'health' | 'social';
type Translate = (key: string, values?: Record<string, string>) => string;
const spacer = (locale: string) => (locale === 'en' ? ' ' : '');

/** Build the localized "why today" sentence for a driver from its evidence key and today's chart. */
function triggerSentence(chart: DailyChart, dim: DailyDimension, t: Translate): string {
  const driver = chart.scoreDrivers?.[dim];
  if (!driver) return '';
  const day = chart.date.ganZhi.day;
  const stem = t(`bazi.stems.${day.stem}`);
  const branch = t(`bazi.branches.${day.branch}`);
  const { hit } = driver;
  let match: RegExpExecArray | null;
  if ((match = /^bazi\.tenGod\.(\w+)\.(\w+)$/.exec(hit)))
    return t('dailyDriver.trigger.god', {
      stem,
      god: t(`bazi.tenGods.${match[1]}`),
      strength: t(`bazi.strength.${match[2]}`),
    });
  if ((match = /^bazi\.branchGod\.(\w+)$/.exec(hit)))
    return t('dailyDriver.trigger.branchGod', { branch, god: t(`bazi.tenGods.${match[1]}`) });
  if (hit === 'bazi.favorableHit' || hit === 'bazi.unfavorableHit')
    return t(`dailyDriver.trigger.${hit === 'bazi.favorableHit' ? 'favorable' : 'unfavorable'}`, {
      element: t(`bazi.elements.${chart.bazi.todayElement}`),
    });
  if ((match = /^bazi\.branch\.(day|month|year|hour)\.(\w+)$/.exec(hit)) && driver.natalBranch)
    return t('dailyDriver.trigger.relation', {
      branch,
      pillar: t(`dailyDriver.pillar.${match[1]}`),
      natalBranch: t(`bazi.branches.${driver.natalBranch}`),
      relation: t(`dailyDriver.relation.${match[2]}`),
    });
  if ((match = /^bazi\.secondary\.(year|luck)\.\w+\.(clash|combine)$/.exec(hit)))
    return t('dailyDriver.trigger.secondary', {
      target: t(`dailyDriver.target.${match[1]}`),
      relation: t(`dailyDriver.secondaryRelation.${match[2]}`),
    });
  if ((match = /^astro\.transit\.([a-z]+)_([a-z]+)_([a-z]+)$/.exec(hit))) {
    const natal = match[3]!;
    return t('dailyDriver.trigger.transit', {
      planet: t(`charts.planet.${match[1]}`),
      aspect: t(`charts.aspect.${match[2]}`),
      natal: t(`charts.${natal === 'asc' || natal === 'mc' ? 'angle' : 'planet'}.${natal}`),
    });
  }
  if ((match = /^astro\.retrograde\.(\w+)$/.exec(hit)))
    return t('dailyDriver.trigger.retrograde', { planet: t(`charts.planet.${match[1]}`) });
  return t('dailyDriver.trigger.card', {
    card: t(`tarot.card.${chart.tarot.card}.name`),
    orientation: t(`tarot.${chart.tarot.reversed ? 'reversed' : 'upright'}`),
  });
}

/**
 * Trigger-aware note and paragraph for one dimension.
 * @returns null for reports computed before `scoreDrivers` existed, so callers keep their prior copy.
 */
export function dailyDimensionCopy(
  chart: DailyChart,
  dim: DailyDimension,
  locale: string,
  t: Translate,
): { note: string; paragraph: string } | null {
  if (!chart.scoreDrivers) return null;
  const driver = chart.scoreDrivers[dim];
  if (!driver) {
    return {
      note: t(`dailyDriver.none.${dim}.note`),
      paragraph: t(`dailyDriver.none.${dim}.effect`),
    };
  }
  const slot = `${driver.category}.${dim}.${driver.direction}`;
  const trigger = triggerSentence(chart, dim, t);
  return {
    note: t(`dailyDriver.note.${slot}`),
    paragraph: [trigger, t(`dailyDriver.effect.${slot}`)].filter(Boolean).join(spacer(locale)),
  };
}

/** Today's Moon and what it means against the natal Moon, in one plain reading with one suggestion. */
export function dailySkyParagraph(chart: DailyChart, locale: string, t: Translate): string {
  const sign = t(`charts.sign.${chart.astro.moonSign}`);
  const natal = chart.astro.natalMoon;
  return [
    t('dailySky.lead', { sign, mood: t(`dailySky.mood.${chart.astro.moonSign}`) }),
    natal
      ? t(`dailySky.relation.${natal.relation}`, { natal: t(`charts.sign.${natal.sign}`) })
      : '',
    t(`dailySky.advice.${chart.astro.moonSign}`),
  ]
    .filter(Boolean)
    .join(spacer(locale));
}
