import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import {
  QimenCategorySchema,
  QimenChartSchema,
  type QimenChart,
  type QimenPalace,
  type Stem,
} from '@tianji/shared';
import {
  ZonedTimeSchema,
  zonedTime,
  calendarAt,
  solarTermAt,
  parseInput,
  elementDelta,
  clampScore,
  verdictFor,
} from '../common/divination';
import { EngineError } from '../common/error';
import { apparentSolarTime } from '../common/solar-time';
import { mod, voidBranches, BRANCHES } from '../common/ganzhi';
import {
  JU_TABLE,
  YANG_TERMS,
  earthPlate,
  RING,
  STARS,
  GATES,
  DEITIES,
  PALACE_TRIGRAMS,
  DIRECTIONS,
  PALACE_ELEMENTS,
  GATE_ELEMENTS,
  GOOD_GATES,
  GOOD_STARS,
  BRANCH_PALACE,
  JI_XING,
  RU_MU,
  xunShou,
  horseBranch,
  lodge,
} from './tables';
import { detectPatterns, PATTERN_RULES } from './patterns';
export * from './tables';
export * from './patterns';
export { QimenChartSchema } from '@tianji/shared';
export const QimenInputSchema = z
  .object({
    at: ZonedTimeSchema,
    place: z
      .object({ lng: z.number().finite().min(-180).max(180), tz: z.string() })
      .strict()
      .optional(),
    category: QimenCategorySchema,
    question: z.string().max(120).optional(),
    options: z
      .object({
        school: z
          .object({
            layout: z.literal('rotating'),
            juMethod: z.literal('chaibu'),
            centerLodge: z.enum(['kun2', 'gen8']),
            useApparentSolarTime: z.boolean(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type QimenInput = z.infer<typeof QimenInputSchema>;
/** Construct rotating sky/star/gate/deity layers for a numeric earth plate and hour pillar. */
export function rotatingPlate(
  dun: 'yang' | 'yin',
  ju: number,
  hour: QimenChart['pillars']['hour'],
  center: 2 | 8 = 2,
) {
  const earth = earthPlate(dun, ju),
    xun = xunShou(hour),
    origin = earth.indexOf(xun.yi) + 1,
    source = lodge(origin, center),
    target = lodge(earth.indexOf(hour.stem === 'jia' ? xun.yi : hour.stem) + 1, center),
    gateTarget = lodge(
      mod(origin - 1 + (dun === 'yang' ? xun.offset : -xun.offset), 9) + 1,
      center,
    );
  const starOffset = mod(
      RING.indexOf(target as (typeof RING)[number]) - RING.indexOf(source as (typeof RING)[number]),
      8,
    ),
    gateOffset = mod(
      RING.indexOf(gateTarget as (typeof RING)[number]) -
        RING.indexOf(source as (typeof RING)[number]),
      8,
    );
  const zhiFu = { star: STARS[origin - 1]!, palaceEarth: origin, palaceSky: target },
    zhiShi = { gate: GATES[source - 1]!, palaceEarth: source, palaceSky: gateTarget };
  const voids = voidBranches(hour.stem, hour.branch).map((b) => BRANCH_PALACE[b]),
    horse = BRANCH_PALACE[horseBranch(hour.branch)];
  const palaces: QimenPalace[] = earth.map((earthStem, i) => {
    const index = i + 1,
      ring = RING.indexOf(index as (typeof RING)[number]);
    const starSource = index === 5 ? 5 : RING[mod(ring - starOffset, 8)]!,
      gateSource = index === 5 ? 5 : RING[mod(ring - gateOffset, 8)]!;
    const palace: QimenPalace = {
      index,
      trigram: PALACE_TRIGRAMS[i]!,
      direction: DIRECTIONS[i]!,
      earthStem,
      skyStem: earth[starSource - 1]!,
      star: STARS[starSource - 1]!,
      gate: GATES[gateSource - 1]!,
      deity:
        index === 5
          ? null
          : DEITIES[
              mod(
                (ring - RING.indexOf(target as (typeof RING)[number])) * (dun === 'yang' ? 1 : -1),
                8,
              )
            ]!,
      flags: [],
      patterns: [],
      ...(index !== 5 && starSource === center ? { hiddenStem: earth[4]! } : {}),
    };
    if (index === 5) return palace;
    if (voids.includes(index)) palace.flags.push('void');
    if (horse === index) palace.flags.push('horse');
    if (starSource === index) palace.flags.push('fu_yin');
    if (starSource + index === 10) palace.flags.push('fan_yin');
    const delta = elementDelta(GATE_ELEMENTS[palace.gate!], PALACE_ELEMENTS[i]!);
    if (delta === 2) palace.flags.push('gate_forced');
    if (delta === 3) palace.flags.push('gate_controlled');
    if (
      JI_XING[palace.skyStem] === index ||
      (palace.hiddenStem && JI_XING[palace.hiddenStem] === index)
    )
      palace.flags.push('ji_xing');
    if (
      RU_MU[palace.skyStem] === index ||
      (palace.hiddenStem && RU_MU[palace.hiddenStem] === index)
    )
      palace.flags.push('ru_mu');
    return palace;
  });
  return {
    earth,
    xunShou: { stem: xun.stem, branch: xun.branch, yi: xun.yi },
    zhiFu,
    zhiShi,
    palaces,
  };
}
/** Compute documented chaibu rotating Qimen at an explicit zoned clock; never reads a clock or external data. */
export function computeQimen(raw: QimenInput): QimenChart {
  const school = raw?.options?.school;
  if (school && (school.layout !== 'rotating' || school.juMethod !== 'chaibu'))
    throw new EngineError('E_UNSUPPORTED_SCHOOL');
  const input = parseInput(QimenInputSchema, raw),
    time = zonedTime(input.at);
  if (input.options.school.useApparentSolarTime && !input.place)
    throw new EngineError('E_REQUIRES_PLACE');
  let clock = time.toPlainDateTime();
  if (input.options.school.useApparentSolarTime) {
    const adjusted = apparentSolarTime(time, input.place!.lng).local;
    clock = Temporal.PlainDateTime.from(adjusted!);
  }
  const calendar = calendarAt(time, clock),
    term = solarTermAt(time);
  const localTerm = term.current.time.withTimeZone(time.timeZoneId);
  const termClock = input.options.school.useApparentSolarTime
    ? Temporal.PlainDateTime.from(apparentSolarTime(localTerm, input.place!.lng).local!)
    : localTerm.toPlainDateTime();
  const termDate =
    termClock.hour === 23 ? termClock.toPlainDate().add({ days: 1 }) : termClock.toPlainDate();
  // Count zi-unified civil days, including the solar-term day; beyond 15 days supplement next term's upper yuan.
  const ziDate = clock.hour === 23 ? clock.toPlainDate().add({ days: 1 }) : clock.toPlainDate();
  const elapsed = termDate.until(ziDate).days,
    termName = elapsed >= 15 ? term.next.name : term.current.name,
    yuanIndex = elapsed >= 15 ? 0 : Math.max(0, Math.floor(elapsed / 5));
  // DESIGN-GAP: §3.2's elapsed-day yuan supersedes external fu-tou yuan; raw and independently adapted Python baselines are retained separately.
  const yuan = (['upper', 'middle', 'lower'] as const)[yuanIndex]!,
    dun = YANG_TERMS.includes(term.current.name) ? 'yang' : 'yin',
    ju = JU_TABLE[termName][yuanIndex]!;
  const plate = rotatingPlate(
    dun,
    ju,
    calendar.pillars.hour,
    input.options.school.centerLodge === 'gen8' ? 8 : 2,
  );
  for (const palace of plate.palaces) {
    if (palace.index !== 5)
      palace.patterns = detectPatterns({
        palace,
        zhiShiPalace: plate.zhiShi.palaceSky,
        dayStem: calendar.pillars.day.stem,
        hourStem: calendar.pillars.hour.stem,
        yi: plate.xunShou.yi,
      });
  }
  const findStem = (stem: Stem) =>
    plate.palaces.find(
      (p) =>
        p.index !== 5 &&
        (p.skyStem === (stem === 'jia' ? plate.xunShou.yi : stem) ||
          p.hiddenStem === (stem === 'jia' ? plate.xunShou.yi : stem)),
    )!.index;
  const dayPalace = findStem(calendar.pillars.day.stem),
    hourPalace = findStem(calendar.pillars.hour.stem);
  const findGate = (gate: QimenPalace['gate']) => plate.palaces.find((p) => p.gate === gate)!.index;
  const findStar = (star: QimenPalace['star']) => plate.palaces.find((p) => p.star === star)!.index;
  const findDeity = (deity: QimenPalace['deity']) =>
    plate.palaces.find((p) => p.deity === deity)!.index;
  const selectors: Record<QimenInput['category'], () => [string, number][]> = {
    career: () => [
      ['kai', findGate('kai')],
      ['day_stem', dayPalace],
      ['zhi_fu', plate.zhiFu.palaceSky],
    ],
    wealth: () => [
      ['sheng', findGate('sheng')],
      ['wu_stem', findStem('wu_stem')],
      ['day_stem', dayPalace],
    ],
    love: () => [
      ['yi', findStem('yi')],
      ['geng', findStem('geng')],
      ['liu_he', findDeity('liu_he')],
      ['day_stem', dayPalace],
    ],
    health: () => [
      ['tian_rui', findStar('tian_rui')],
      ['day_stem', dayPalace],
      ['yi', findStem('yi')],
      ['tian_xin', findStar('tian_xin')],
    ],
    travel: () => [
      ['jing_view', findGate('jing_view')],
      ['kai', findGate('kai')],
      ['horse', BRANCH_PALACE[horseBranch(calendar.pillars.hour.branch)]],
      ['day_stem', dayPalace],
    ],
    exam: () => [
      ['jing_view', findGate('jing_view')],
      ['ding', findStem('ding')],
      ['tian_fu', findStar('tian_fu')],
      ['day_stem', dayPalace],
    ],
    lost: () => [
      ['liu_he', findDeity('liu_he')],
      ['xuan_wu', findDeity('xuan_wu')],
      ['hour_stem', hourPalace],
      ['day_stem', dayPalace],
    ],
    general: () => [
      ['day_stem', dayPalace],
      ['hour_stem', hourPalace],
      ['zhi_fu', plate.zhiFu.palaceSky],
      ['zhi_shi', plate.zhiShi.palaceSky],
    ],
  };
  const useGods = selectors[input.category]().map(([key, palaceIndex]) => {
    const p = plate.palaces[palaceIndex - 1]!;
    return {
      key,
      palaceIndex,
      state: [
        ...p.flags,
        ...p.patterns,
        ...(p.gate && GOOD_GATES.includes(p.gate) ? ['good_gate'] : []),
        ...(GOOD_STARS.includes(p.star) ? ['good_star'] : []),
      ],
    };
  });
  const findings = plate.palaces.flatMap((p) => [...p.patterns, ...p.flags]);
  const unique = [...new Set(useGods.map((g) => g.palaceIndex))];
  const weights = unique.map((index) => {
    const p = plate.palaces[index - 1]!;
    let weight =
      (p.gate && GOOD_GATES.includes(p.gate) ? 2 : 0) + (GOOD_STARS.includes(p.star) ? 1 : 0);
    for (const key of p.patterns)
      weight += PATTERN_RULES.find((r) => r.key === key)!.auspicious ? 2 : -2;
    for (const flag of p.flags)
      weight += {
        void: -1,
        ru_mu: -1,
        gate_forced: -1,
        ji_xing: -1,
        fu_yin: -1,
        fan_yin: -0.5,
        horse: 0,
        gate_controlled: 0,
      }[flag];
    if (index !== dayPalace) {
      const delta = elementDelta(PALACE_ELEMENTS[dayPalace - 1]!, PALACE_ELEMENTS[index - 1]!);
      if (delta === 1 || delta === 4) {
        weight += 1;
        findings.push('use_god_generated');
      }
      if (delta === 2 || delta === 3) {
        weight -= 1;
        findings.push('use_god_controlled');
      }
    }
    return weight;
  });
  // DESIGN-GAP: Category scores average unique use-god palaces, scale one rule point to seven score points; timing uses branches of favorable palaces.
  const score = clampScore(
    Math.round(50 + (7 * weights.reduce((a, b) => a + b, 0)) / weights.length),
  );
  const good = plate.palaces.filter(
    (p) =>
      p.index !== 5 &&
      p.gate &&
      GOOD_GATES.includes(p.gate) &&
      GOOD_STARS.includes(p.star) &&
      !p.flags.some((f) => ['void', 'gate_forced', 'ru_mu', 'ji_xing'].includes(f)),
  );
  return QimenChartSchema.parse({
    castAt: {
      local: time.toPlainDateTime().toString(),
      tz: time.timeZoneId,
      ...(input.options.school.useApparentSolarTime ? { adjusted: clock.toString() } : {}),
    },
    pillars: calendar.pillars,
    dun,
    ju,
    solarTerm: { name: term.current.name, yuan },
    xunShou: plate.xunShou,
    zhiFu: plate.zhiFu,
    zhiShi: plate.zhiShi,
    palaces: plate.palaces,
    useGods,
    verdict: verdictFor(score),
    score,
    favorableDirections: good.map((p) => p.direction),
    timing: {
      favorableHours: BRANCHES.filter((b) => good.some((p) => p.index === BRANCH_PALACE[b])),
    },
    findings: [...new Set(findings)],
  });
}
