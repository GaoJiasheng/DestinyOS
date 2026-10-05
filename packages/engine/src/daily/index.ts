import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import {
  DailyChartSchema,
  NormalizedBirthSchema,
  BaziChartSchema,
  AstroChartSchema,
  VedicChartSchema,
  type DailyChart,
  type PillarKey,
} from '@tianji/shared';
import { parseInput, calendarAt, solarTerms } from '../common/divination';
import { personalNumbers } from '../numerology';
import { EngineError } from '../common/error';
import { STEM_ELEMENTS, HIDDEN_STEMS, tenGod } from '../common/ganzhi';
import { branchRelations, STEM_CLASHES, STEM_COMBINATIONS } from '../common/relations';
import { toSolar } from '../bazi/calendar';
import { HIDDEN_WEIGHTS } from '../bazi/pillars';
import { computePanchang } from '../astrology/panchang';
import { drawDaily } from '../tarot';
import {
  luckyColor,
  LUCKY_NUMBERS,
  DAILY_DIRECTIONS,
  goodHours,
  nobleZodiac,
  mapAlmanac,
} from './indicators';
import { dailyAstro } from './transits';
import { scoreDaily } from './scoring';
import { selectDailyActions } from './actions';
export { DailyChartSchema } from '@tianji/shared';
export type { DailyChart } from '@tianji/shared';
export * from './scoring';
export * from './actions';
export * from './indicators';
export * from './transits';
export const DailyInputSchema = z
  .object({
    birth: NormalizedBirthSchema,
    baziChart: BaziChartSchema,
    astroChart: AstroChartSchema.nullable(),
    vedicChart: VedicChartSchema.nullable(),
    date: z
      .object({ local: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tz: z.string().min(1) })
      .strict(),
    seed: z.string().min(1),
  })
  .strict();
export type DailyInput = z.infer<typeof DailyInputSchema>;
// DESIGN-GAP: Current authorized location and KU action candidates are optional second-argument inputs because §2 omits both; engines never request browser geolocation or read a database.
const optionsSchema = z
  .object({
    place: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      })
      .strict()
      .optional(),
    actionUnits: z
      .array(
        z
          .object({
            id: z.string().min(1),
            findings: z.array(z.string()),
            weight: z.number().finite().nonnegative(),
            do: z.array(z.string().regex(/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/)),
            dont: z.array(z.string().regex(/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/)),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export type DailyOptions = z.infer<typeof optionsSchema>;
/** Resolve local date for an explicit instant, never the host's system clock. */
export function dailyDateAt(instant: string, tz: string): DailyInput['date'] {
  try {
    return {
      local: Temporal.Instant.from(instant).toZonedDateTimeISO(tz).toPlainDate().toString(),
      tz,
    };
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
}
/** Offline, deterministic daily aggregation; natal charts may be cached independently of the requested day. */
export function computeDaily(raw: DailyInput, rawOptions: DailyOptions = {}): DailyChart {
  const input = parseInput(DailyInputSchema, raw),
    options = parseInput(optionsSchema, rawOptions);
  const {
    noon,
    calendar,
    flowDay,
    natal,
    todayElement,
    favorableHit,
    unfavorableHit,
    relations,
    secondaryRelations,
  } = dailyBaziContext(input);
  // DESIGN-GAP: Element balance is percentage of natal raw weights plus the daily stem (1) and hidden-stem weights (1/.5/.3), with no extra natal seasonal bonus.
  const balance = { ...natal.elements.raw };
  balance[todayElement] += 1;
  HIDDEN_STEMS[flowDay.branch].forEach(
    (stem, i) => (balance[STEM_ELEMENTS[stem]] += HIDDEN_WEIGHTS[i]!),
  );
  const total = Object.values(balance).reduce((sum, weight) => sum + weight, 0);
  for (const element of Object.keys(balance) as (keyof typeof balance)[])
    balance[element] = Math.round((balance[element] / total) * 1e8) / 1e6;
  // DESIGN-GAP: Empty favorable set falls back to natal day-master element, without changing favorableHit.
  const luckyElement = natal.useGod.favorable[0] ?? natal.dayMaster.element,
    color = luckyColor(luckyElement, input.seed);
  const lunar = toSolar(noon.toPlainDateTime()).getLunar();
  const almanac = {
    yi: mapAlmanac(lunar.getDayYi()).slice(0, 3),
    ji: mapAlmanac(lunar.getDayJi()).slice(0, 3),
  };
  // DESIGN-GAP: Do not fabricate 2–3 Yi/Ji items when the library has fewer modern whitelist matches; contradictory mapped Ji takes precedence.
  almanac.yi = almanac.yi.filter((key) => !almanac.ji.includes(key));
  const astro = dailyAstro(
    input.date.local,
    input.date.tz,
    input.astroChart,
    input.birth.timeUnknown,
  );
  const drawn = drawDaily(input.seed),
    tarot = { card: drawn.cardKey, reversed: drawn.reversed };
  const god = tenGod(natal.dayMaster.stem, flowDay.stem);
  const scored = scoreDaily({
    god,
    strength: natal.strength.level,
    favorableHit,
    unfavorableHit,
    dayRelations: relations,
    secondaryRelations,
    astro,
    tarot,
  });
  const findings = [
    ...new Set([
      ...scored.findings,
      ...relations.map((r) => `bazi.branch.${r.pillar}.${r.type}`),
      ...secondaryRelations.map((r) => `bazi.secondary.${r.target}.${r.kind}.${r.type}`),
      ...astro.transits.map((t) => `astro.transit.${t.transiting}_${t.aspect}_${t.natal}`),
      `astro.moon_sign.${astro.moonSign}`,
      `astro.moon_phase.${astro.moonPhase.name}`,
      ...astro.retrogrades.map((body) => `astro.retrograde.${body}`),
      ...(astro.moonIngress ? [`astro.moon_ingress.${astro.moonIngress.sign}`] : []),
      ...(astro.lunation ? [`astro.lunation.${astro.lunation}`] : []),
      `tarot.daily.${tarot.card}.${tarot.reversed ? 'reversed' : 'upright'}`,
    ]),
  ];
  const midnight = noon.withPlainTime('00:00'),
    end = midnight.add({ days: 4 });
  const term = solarTerms(noon.year).find(
    (t) =>
      Temporal.ZonedDateTime.compare(t.time, midnight) >= 0 &&
      Temporal.ZonedDateTime.compare(t.time, end) < 0,
  );
  // DESIGN-GAP: With no birth/current coordinates, use the target zone's noon UTC-offset meridian and latitude 0; location is approximate and never inferred from a network.
  const place = options.place ?? {
    lat: input.birth.place.lat ?? 0,
    lng: input.birth.place.lng ?? ((noon.offsetNanoseconds / 1e9 / 240 + 540) % 360) - 180,
  };
  const vedic = computePanchang(input.date.local, { ...place, tz: input.date.tz });
  return DailyChartSchema.parse({
    date: {
      ...input.date,
      ganZhi: { year: calendar.pillars.year, month: calendar.pillars.month, day: flowDay },
      lunar: calendar.lunar,
      ...(term
        ? { solarTerm: { name: term.name, at: term.time.withTimeZone(input.date.tz).toString() } }
        : {}),
    },
    bazi: {
      dayMasterRelation: god,
      branchRelation: relations.find((r) => r.pillar === 'day')?.type ?? 'none',
      elementBalance: balance,
      favorable: natal.useGod.favorable,
      unfavorable: natal.useGod.unfavorable,
      todayElement,
      favorableHit,
      unfavorableHit,
      branchRelations: relations,
      secondaryRelations,
      luckyColor: [color.name],
      luckyColorHex: color.hex,
      luckyColorElement: luckyElement,
      luckyNumbers: LUCKY_NUMBERS[luckyElement],
      luckyDirection: DAILY_DIRECTIONS[luckyElement],
      goodHours: goodHours(flowDay.stem, flowDay.branch, natal.useGod.favorable),
      nobleZodiac: nobleZodiac(flowDay.branch),
      almanac,
    },
    astro,
    tarot,
    vedic,
    numerology: {
      personalDay: personalNumbers(input.birth.local.month, input.birth.local.day, input.date.local)
        .day,
    },
    scores: scored.scores,
    findings,
    oneLiner: scored.oneLiner,
    doDont: selectDailyActions(input.seed, findings, almanac, options.actionUnits),
  });
}

/** Shared scoring context for daily reports and the calendar; all dates use explicit IANA zones. */
export function dailyBaziContext(input: Pick<DailyInput, 'date' | 'birth' | 'baziChart'>) {
  let noon: Temporal.ZonedDateTime;
  try {
    noon = Temporal.PlainDate.from(input.date.local).toZonedDateTime({
      timeZone: input.date.tz,
      plainTime: '12:00',
    });
    if (noon.toPlainDate().toString() !== input.date.local)
      throw new EngineError('E_INVALID_INPUT');
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
  if (noon.year < 1900 || noon.year > 2100) throw new EngineError('E_DATE_OUT_OF_RANGE');
  const calendar = calendarAt(noon),
    { day: flowDay, year: flowYear } = calendar.pillars;
  const natal = input.baziChart,
    todayElement = STEM_ELEMENTS[flowDay.stem];
  const favorableHit = natal.useGod.favorable.includes(todayElement),
    unfavorableHit = natal.useGod.unfavorable.includes(todayElement);
  const relations: DailyChart['bazi']['branchRelations'] = (
    ['day', 'year', 'month', 'hour'] as PillarKey[]
  ).flatMap((pillar) => {
    const p = natal.pillars[pillar];
    return p ? branchRelations(flowDay.branch, p.branch).map((type) => ({ pillar, type })) : [];
  });
  const secondaryRelations: DailyChart['bazi']['secondaryRelations'] = [];
  // DESIGN-GAP: Re-select the luck period at the target date instead of trusting cached isCurrent flags; intervals use exact startAge and the natal adjusted clock, not overlapping calendar-year bounds.
  const luckStart = Temporal.PlainDateTime.from(
    natal.solarTimeAdjust.adjusted ?? natal.solarTimeAdjust.original,
  )
    .add(natal.luck.startAge)
    .toZonedDateTime(input.birth.local.tz);
  const period = natal.luck.periods.find(
    (_, i) =>
      Temporal.ZonedDateTime.compare(noon, luckStart.add({ years: i * 10 })) >= 0 &&
      Temporal.ZonedDateTime.compare(noon, luckStart.add({ years: (i + 1) * 10 })) < 0,
  );
  for (const [target, pair] of [
    ['year', flowYear],
    ['luck', period],
  ] as const) {
    if (!pair) continue;
    for (const type of branchRelations(flowDay.branch, pair.branch))
      if (type === 'clash' || type === 'combine')
        secondaryRelations.push({ target, kind: 'branch', type });
    for (const [type, groups] of [
      ['clash', STEM_CLASHES],
      ['combine', STEM_COMBINATIONS],
    ] as const) {
      if (
        groups.some(
          (group) =>
            (group as readonly string[]).includes(flowDay.stem) &&
            (group as readonly string[]).includes(pair.stem) &&
            flowDay.stem !== pair.stem,
        )
      )
        secondaryRelations.push({ target, kind: 'stem', type });
    }
  }
  return {
    noon,
    calendar,
    flowDay,
    natal,
    todayElement,
    favorableHit,
    unfavorableHit,
    relations,
    secondaryRelations,
  };
}
export * from './range';
