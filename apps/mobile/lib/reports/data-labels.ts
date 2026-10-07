import type { MobileLocale } from '../i18n';
import type { ChartLabel } from './chart-primitives';
import type { KnowledgeBundle } from '@tianji/content';
import { localeText } from '@tianji/shared/locale';

// DESIGN-GAP: Ordinary chart details use localized labels and context-specific enum names;
// exact schema paths/values remain available in the explicitly selected professional view.
const prefixes: Record<string, string[]> = {
  stem: ['bazi.stems'],
  skyStem: ['bazi.stems'],
  earthStem: ['bazi.stems'],
  hiddenStem: ['bazi.stems'],
  branch: ['bazi.branches'],
  stemElement: ['bazi.elements'],
  branchElement: ['bazi.elements'],
  element: ['bazi.elements'],
  tenGod: ['bazi.tenGods'],
  branchTenGod: ['bazi.tenGods'],
  naYin: ['bazi.naYin'],
  lifeStage: ['bazi.lifeStages'],
  pillar: ['bazi.chart'],
  role: ['bazi.chart'],
  source: ['bazi.chart', 'mobile.report.data.values'],
  level: ['bazi.strength'],
  brightness: ['ziwei.chart.brightness'],
  mutagen: ['ziwei.chart.mutagen'],
  adjectiveStars: ['ziwei.chart.star'],
  changsheng12: ['ziwei.chart.star'],
  boshi12: ['ziwei.chart.star'],
  jiangqian12: ['ziwei.chart.star'],
  suiqian12: ['ziwei.chart.star'],
  upper: ['divination.trigrams'],
  lower: ['divination.trigrams'],
  body: ['divination.trigrams'],
  use: ['divination.trigrams'],
  trigram: ['divination.trigrams'],
  relation: ['divination.relations'],
  changingRelation: ['divination.relations'],
  mutualRelation: ['divination.relations'],
  seasonalStrength: ['divination.strengths'],
  direction: ['divination.directions'],
  star: ['divination.symbols'],
  gate: ['divination.symbols'],
  deity: ['divination.symbols'],
  flags: ['divination.flags'],
  sign: ['charts.sign'],
  navamsaSign: ['charts.sign'],
  nakshatra: ['charts.nakshatra'],
  dignity: ['charts.dignity'],
  ruler: ['charts.planet', 'charts.graha'],
  lord: ['charts.graha'],
  key: [
    'charts.planet',
    'charts.graha',
    'ziwei.chart.palace',
    'ziwei.chart.star',
    'synastry.koota',
  ],
  position: ['mobile.report.data.values'],
  a: ['synastry.trait'],
  b: ['synastry.trait'],
};

/** Localize a presentation path without modifying its persisted schema identity. */
export function dataPathLabel(path: string, t: ChartLabel): string {
  return path
    .split('.')
    .filter(Boolean)
    .map((part) =>
      /^\d+$/.test(part)
        ? String(Number(part) + 1)
        : t(`mobile.report.data.fields.${part}`, t('report.dataPath')),
    )
    .join(' · ');
}

/** Context disambiguates identical codes such as stem ji and transformation ji. */
export function dataValueLabel(
  value: unknown,
  path: string,
  locale: MobileLocale,
  t: ChartLabel,
  catalog: Record<string, string>,
  knowledge: KnowledgeBundle,
): string {
  if (value === null || value === undefined) return t('charts.unavailable');
  if (typeof value === 'boolean') return t(value ? 'bazi.chart.enabled' : 'bazi.chart.disabled');
  if (typeof value !== 'string') return String(value);
  // DESIGN-GAP: Derived period instants retain second precision in explicitly labelled UTC,
  // replacing ISO's Latin T/Z markers without converting them to the device's local zone.
  if (/^\d{4}-\d\d-\d\dT/.test(value)) {
    const text = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
    return t('mobile.report.data.values.utcDate', undefined, { text });
  }
  if (!/[A-Za-z\p{Script=Han}]/u.test(value)) return value;
  const field =
    path
      .split('.')
      .filter((part) => !/^\d+$/.test(part))
      .at(-1) ?? '';
  for (const prefix of prefixes[field] ?? []) {
    const key = `${prefix}.${value}`;
    if (key in catalog) return t(key);
  }
  if (field === 'position') {
    const key = Object.keys(catalog).find(
      (item) => item.startsWith('tarot.position.') && item.endsWith(`.${value}.name`),
    );
    if (key) return t(key);
  }
  const hexagram = /^hexagram_(\d+)$/.exec(value)?.[1];
  const entry = knowledge.glossary.find(
    (item) => item.key === (hexagram ? `hexagram.${hexagram}` : value),
  );
  if (entry) return t(`glossary.${entry.key}.term`);
  if (field === 'patterns') {
    const unit = knowledge.units.find((item) => item.id === `qimen.patterns.${value}`);
    if (unit)
      return t('report.content', localeText(unit[locale === 'en' ? 'en' : 'zh'].title, locale));
  }
  // DESIGN-GAP: A future unlabelled schema addition points to the lossless professional
  // view instead of leaking an untranslated identifier into ordinary chart details.
  return t('mobile.report.data.values.untranslated');
}
