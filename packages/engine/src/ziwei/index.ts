import { Temporal } from '@js-temporal/polyfill';
import { Solar } from 'lunar-typescript';
import { astro } from 'iztro';
import i18nImport from 'iztro/lib/i18n/index.js';
import { z } from 'zod';
import {
  Palace,
  ZIWEI_MAJOR_STARS,
  Branch,
  Mutagen,
  ZiweiChartSchema,
  NormalizedBirthSchema,
  type ZiweiChart,
  type NormalizedBirth,
} from '@tianji/shared';
import { EngineError } from '../common/error';
import { mapStar, mapBrightness, mapBranch, mapStem } from './mapping';
import { detectPatterns } from './patterns';
// DESIGN-GAP: Native Node ESM needs the concrete CJS entry and its default wrapper; bundlers expose the instance directly.
const i18nModule = i18nImport as typeof i18nImport | { default: typeof i18nImport };
const i18n = 'default' in i18nModule ? i18nModule.default : i18nModule;
export { ZiweiChartSchema } from '@tianji/shared';
export type { ZiweiChart } from '@tianji/shared';
export * from './patterns';
export const ZIWEI_SCHOOL_DEFAULTS = {
  leapMonth: 'split_by_15',
  useApparentSolarTime: true,
  siHuaTable: 'zhongzhou',
} as const;
const schoolSchema = z
  .object({
    leapMonth: z.enum(['split_by_15', 'as_next', 'as_prev']).default('split_by_15'),
    useApparentSolarTime: z.boolean().default(true),
    siHuaTable: z.literal('zhongzhou').default('zhongzhou'),
  })
  .strict();
export type ZiweiSchool = z.input<typeof schoolSchema>;
export type ZiweiInput = {
  birth: NormalizedBirth;
  options?: { school?: ZiweiSchool };
  now: string | Temporal.ZonedDateTime | Temporal.Instant;
};
/** Map clock hour (0–23) to iztro timeIndex: early Zi=0, late Zi=12. */
export function ziweiTimeIndex(hour: number): number {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new EngineError('E_INVALID_INPUT');
  return Math.floor((hour + 1) / 2);
}
/** Validate twelve unique palaces, fourteen major stars exactly once and consecutive ten-year decades. */
export function validateZiweiChart(raw: unknown): asserts raw is ZiweiChart {
  const parsed = ZiweiChartSchema.safeParse(raw);
  if (!parsed.success) throw new EngineError('E_ENGINE_INTERNAL');
  const chart = parsed.data;
  const stars = chart.palaces.flatMap((p) => p.majorStars.map((s) => s.key));
  const decades = [...chart.palaces].sort((a, b) => a.decadal.fromAge - b.decadal.fromAge);
  const invalid =
    stars.length !== 14 ||
    ZIWEI_MAJOR_STARS.some((key) => stars.filter((s) => s === key).length !== 1) ||
    new Set(chart.palaces.map((p) => p.key)).size !== 12 ||
    new Set(chart.palaces.map((p) => p.branch)).size !== 12 ||
    chart.palaces.some((p, i) => p.index !== i || p.key !== Object.values(Palace)[i]) ||
    chart.palaces.filter((p) => p.isBodyPalace).length !== 1 ||
    decades[0]!.decadal.fromAge !== chart.basics.fiveElementsClass.number ||
    decades.some(
      (p, i) =>
        p.decadal.toAge !== p.decadal.fromAge + 9 ||
        p.decadal.toYear !== p.decadal.fromYear + 9 ||
        (i > 0 &&
          (p.decadal.fromAge !== decades[i - 1]!.decadal.toAge + 1 ||
            p.decadal.fromYear !== decades[i - 1]!.decadal.toYear + 1)),
    );
  if (invalid) throw new EngineError('E_ENGINE_INTERNAL');
}
/** Wrap iztro 2.6.1 default algorithm. Birth clocks are already normalized by common, now is explicit. */
export function computeZiwei(input: ZiweiInput): ZiweiChart {
  const parsed = NormalizedBirthSchema.safeParse(input.birth);
  if (!parsed.success) throw new EngineError('E_INVALID_INPUT');
  const birth = parsed.data;
  if (birth.timeUnknown) throw new EngineError('E_REQUIRES_BIRTH_TIME');
  const schoolResult = schoolSchema.safeParse(input.options?.school ?? {});
  if (!schoolResult.success) throw new EngineError('E_UNSUPPORTED_SCHOOL');
  const school = schoolResult.data;
  const clock =
    school.useApparentSolarTime && birth.solarTime.local ? birth.solarTime.local : birth.local;
  const timeIndex = ziweiTimeIndex(clock.hour!);
  let now: Temporal.ZonedDateTime;
  try {
    now =
      input.now instanceof Temporal.ZonedDateTime
        ? input.now
        : Temporal.Instant.from(input.now.toString()).toZonedDateTimeISO(birth.place.tz);
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
  const solar = Solar.fromYmd(clock.year, clock.month, clock.day);
  const lunar = solar.getLunar();
  // DESIGN-GAP: Unspecified gender uses the male layout (Fixture F), never an inferred personal gender.
  const gender = birth.gender === 'female' ? '女' : '男';
  const previous = astro.getConfig();
  const previousMutagens = { ...previous.mutagens },
    previousBrightness = { ...previous.brightness };
  const previousLanguage = i18n.language;
  try {
    // iztro configuration is global: isolate all caller overrides, and restore synchronously in finally.
    for (const key of Object.keys(previous.mutagens))
      Reflect.deleteProperty(previous.mutagens, key);
    for (const key of Object.keys(previous.brightness))
      Reflect.deleteProperty(previous.brightness, key);
    astro.config({
      algorithm: 'default',
      yearDivide: 'normal',
      horoscopeDivide: 'normal',
      ageDivide: 'normal',
      dayDivide: 'forward',
    });
    const date = `${clock.year}-${clock.month}-${clock.day}`;
    const isLeap = lunar.getMonth() < 0;
    // For day 16–30, iztro already advances the palace month; keep the real date (next month may lack day 30).
    const astrolabe =
      school.leapMonth === 'as_next' && isLeap && lunar.getDay() <= 15
        ? astro.byLunar(
            `${lunar.getYear()}-${Math.abs(lunar.getMonth()) + 1}-${lunar.getDay()}`,
            timeIndex,
            gender,
            false,
            false,
            'zh-CN',
          )
        : astro.bySolar(date, timeIndex, gender, school.leapMonth !== 'as_prev', 'zh-CN');
    // DESIGN-GAP: Ignore iztro's clock-derived copyright; only mapped deterministic chart data leave the adapter.
    const h = astrolabe.horoscope(now.toPlainDate().toString(), ziweiTimeIndex(now.hour));
    if (h.decadal.index < 0) throw new EngineError('E_DATE_OUT_OF_RANGE');
    const palaceKeys = Object.values(Palace);
    const libraryNames = [
      '命宫',
      '兄弟',
      '夫妻',
      '子女',
      '财帛',
      '疾厄',
      '迁移',
      '仆役',
      '官禄',
      '田宅',
      '福德',
      '父母',
    ];
    const mutagenNames: Record<string, Mutagen> = { 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' };
    const mapStars = (stars: (typeof astrolabe.palaces)[number]['minorStars']) =>
      stars.map((s) => ({
        key: mapStar(s.name),
        ...(s.brightness ? { brightness: mapBrightness(s.brightness) } : {}),
        ...(s.mutagen ? { mutagen: mutagenNames[s.mutagen] } : {}),
      }));
    const palaces = palaceKeys.map((key, index) => {
      const p = astrolabe.palaces.find((p) => p.name === libraryNames[index]);
      if (!p) throw new EngineError('E_ENGINE_INTERNAL');
      return {
        index,
        key,
        branch: mapBranch(p.earthlyBranch),
        stem: mapStem(p.heavenlyStem),
        isBodyPalace: p.isBodyPalace,
        majorStars: mapStars(p.majorStars).map((s) => ({ ...s, brightness: s.brightness! })),
        minorStars: mapStars(p.minorStars),
        adjectiveStars: p.adjectiveStars.map((s) => mapStar(s.name)),
        changsheng12: mapStar(p.changsheng12),
        boshi12: mapStar(p.boshi12),
        jiangqian12: mapStar(p.jiangqian12),
        suiqian12: mapStar(p.suiqian12),
        decadal: {
          fromAge: p.decadal.range[0],
          toAge: p.decadal.range[1],
          fromYear: lunar.getYear() + p.decadal.range[0] - 1,
          toYear: lunar.getYear() + p.decadal.range[1] - 1,
        },
        ages: [...p.ages],
      };
    });
    const palaceIndex = (index: number) => {
      const branch = mapBranch(astrolabe.palaces[index]!.earthlyBranch);
      return palaces.findIndex((p) => p.branch === branch);
    };
    const mutagens = (stars: string[]) => ({
      lu: mapStar(stars[0]!),
      quan: mapStar(stars[1]!),
      ke: mapStar(stars[2]!),
      ji: mapStar(stars[3]!),
    });
    const fiveElements: Record<string, ZiweiChart['basics']['fiveElementsClass']> = {
      水二局: { name: 'water_2', number: 2 },
      木三局: { name: 'wood_3', number: 3 },
      金四局: { name: 'metal_4', number: 4 },
      土五局: { name: 'earth_5', number: 5 },
      火六局: { name: 'fire_6', number: 6 },
    };
    // Late Zi advances the lunar day exactly once; iztro retains the unadvanced raw date for presentation.
    const effectiveLunar = timeIndex === 12 ? solar.next(1).getLunar() : lunar;
    const current = palaces[palaceIndex(h.decadal.index)]!;
    const nominalAge =
      Solar.fromYmd(now.year, now.month, now.day).getLunar().getYear() - lunar.getYear() + 1;
    // DESIGN-GAP: Before bureau start, expose iztro childhood palace with age range 1..bureau-1.
    const childhood = nominalAge < fiveElements[astrolabe.fiveElementsClass]!.number;
    const chart: ZiweiChart = {
      basics: {
        lunar: {
          year: effectiveLunar.getYear(),
          month: Math.abs(effectiveLunar.getMonth()),
          isLeap: effectiveLunar.getMonth() < 0,
          day: effectiveLunar.getDay(),
          hourBranch: Object.values(Branch)[timeIndex % 12]!,
        },
        yearStem: mapStem(astrolabe.rawDates.chineseDate.yearly[0]),
        yearBranch: mapBranch(astrolabe.rawDates.chineseDate.yearly[1]),
        fiveElementsClass: fiveElements[astrolabe.fiveElementsClass]!,
        soulMaster: mapStar(astrolabe.soul),
        bodyMaster: mapStar(astrolabe.body),
        soulPalaceBranch: mapBranch(astrolabe.earthlyBranchOfSoulPalace),
        bodyPalaceBranch: mapBranch(astrolabe.earthlyBranchOfBodyPalace),
        zodiac: mapBranch(astrolabe.rawDates.chineseDate.yearly[1]),
      },
      palaces,
      horoscope: {
        decadal: {
          palaceIndex: current.index,
          stem: mapStem(h.decadal.heavenlyStem),
          mutagens: mutagens(h.decadal.mutagen),
          fromAge: childhood ? 1 : current.decadal.fromAge,
          toAge: childhood
            ? fiveElements[astrolabe.fiveElementsClass]!.number - 1
            : current.decadal.toAge,
        },
        yearly: {
          year: Solar.fromYmd(now.year, now.month, now.day).getLunar().getYear(),
          palaceIndex: palaceIndex(h.yearly.index),
          stem: mapStem(h.yearly.heavenlyStem),
          branch: mapBranch(h.yearly.earthlyBranch),
          mutagens: mutagens(h.yearly.mutagen),
        },
      },
      patterns: [],
      emptyPalaces: palaces.filter((p) => !p.majorStars.length).map((p) => p.key),
    };
    validateZiweiChart(chart);
    chart.patterns = detectPatterns(chart);
    return chart;
  } catch (error) {
    if (error instanceof EngineError) throw error;
    throw new EngineError('E_ENGINE_INTERNAL');
  } finally {
    Object.assign(previous.mutagens, previousMutagens);
    Object.assign(previous.brightness, previousBrightness);
    astro.config({
      algorithm: previous.algorithm,
      yearDivide: previous.yearDivide,
      horoscopeDivide: previous.horoscopeDivide,
      dayDivide: previous.dayDivide,
      ageDivide: previous.ageDivide,
    });
    if (previousLanguage) i18n.changeLanguage(previousLanguage);
  }
}
