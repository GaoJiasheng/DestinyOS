import { expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { Angle, Aspect, Planet, Sign } from '@tianji/shared';
import { shellMessages } from '../i18n/client-messages';
import { dailyMessages, featureMessages } from '../i18n/feature-messages';
import { toMessages } from '../i18n/catalog';
import { systems } from '../lib/system-links';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import tw from '../messages/zh-TW.json';
import zhInterpretation from '../messages/zh/interpretation.json';
import enInterpretation from '../messages/en/interpretation.json';
import twInterpretation from '../messages/zh-TW/interpretation.json';
for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const) {
  it(`${locale}: shell keeps navigation and personal preview keys while excluding private feature prose`, () => {
    const messages = shellMessages(toMessages(catalog));
    const t = createTranslator({ locale, messages });
    for (const system of systems) {
      expect(t(`${system}.placeholder`)).toBe(catalog[`${system}.placeholder`]);
      expect(t(`nav.${system}`)).toBe(catalog[`nav.${system}`]);
    }
    expect(t('synastry.requiresTwo')).toBe(catalog['synastry.requiresTwo']);
    expect(t('daily.color.teal')).toBe(catalog['daily.color.teal']);
    expect(t('bazi.stems.jia')).toBe(catalog['bazi.stems.jia']);
    expect(t('art.states.disclaimer')).toBe(catalog['art.states.disclaimer']);
    expect(t('art.states.error')).toBe(catalog['art.states.error']);
    expect(messages.glossary).toBeUndefined();
    expect(messages.rectification).toBeUndefined();
    expect(Object.keys(messages.charts ?? {})).toEqual(['planet']);
    expect(t('charts.planet.sun')).toBe(catalog['charts.planet.sun']);
    expect(Buffer.byteLength(JSON.stringify(messages))).toBeLessThan(60000);
  });
}

// components/daily reads these keys through template strings, so a missing namespace only surfaces at runtime as MISSING_MESSAGE.
const planets = Object.values(Planet);
const dailyDynamicKeys = [
  ...planets.map((key) => `charts.planet.${key}`),
  ...Object.values(Aspect).map((key) => `charts.aspect.${key}`),
  ...Object.values(Sign).map((key) => `charts.sign.${key}`),
  `charts.angle.${Angle.asc}`,
  `charts.angle.${Angle.mc}`,
];
const dailyDynamicPrefixes = [
  'charts.panchang',
  'bazi.stems',
  'bazi.branches',
  'daily.moonPhase',
  'daily.rating',
  'daily.dimension',
  'daily.zodiac',
  'daily.panchang',
  'home.term',
  'report.sections.daily',
];
const calendarDynamicPrefixes = [
  'charts.planet',
  'charts.graha',
  'daily.rating',
  'calendar.event',
  'calendar.explanation',
];
function node(messages: object, path: string) {
  return path.split('.').reduce<unknown>((value, part) => {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)[part]
      : undefined;
  }, messages);
}
function expectNamespace(messages: object, prefix: string) {
  const value = node(messages, prefix);
  expect(value, prefix).toBeTypeOf('object');
  expect(Object.keys(value as object).length, prefix).toBeGreaterThan(0);
}
for (const [locale, catalog] of [
  ['zh', { ...zh, ...zhInterpretation }],
  ['en', { ...en, ...enInterpretation }],
  ['zh-TW', { ...tw, ...twInterpretation }],
] as const) {
  const full = toMessages(catalog);
  it(`${locale}: the today provider carries every dynamic chart and daily key`, () => {
    const messages = dailyMessages(full);
    const t = createTranslator({ locale, messages });
    for (const key of dailyDynamicKeys)
      expect(t(key as Parameters<typeof t>[0]), key).toBe(catalog[key as keyof typeof catalog]);
    for (const prefix of dailyDynamicPrefixes) expectNamespace(messages, prefix);
  });
  it(`${locale}: the calendar provider carries its dynamic keys`, () => {
    const messages = featureMessages(full);
    for (const prefix of calendarDynamicPrefixes) expectNamespace(messages, prefix);
  });
  it(`${locale}: the root shell can name every planet for the home sky`, () => {
    const messages = shellMessages(full);
    const t = createTranslator({ locale, messages });
    for (const key of planets)
      expect(t(`charts.planet.${key}` as Parameters<typeof t>[0])).toBe(
        catalog[`charts.planet.${key}` as keyof typeof catalog],
      );
  });
}
