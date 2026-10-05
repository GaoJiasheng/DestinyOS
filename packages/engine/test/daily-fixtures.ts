import { type DailyTransit } from '@tianji/shared';
import {
  computeAstrology,
  computeBazi,
  computeDaily,
  DAILY_SCORE_RULES,
  hashSeed,
  normalizeBirth,
  scoreDaily,
  type DailyInput,
  type DailyScoreContext,
  type Position,
} from '../src';
import A from './fixtures/birth/A.json';
/** Shared daily fixture setup for the split regression suites. */
export const birth = normalizeBirth(A),
  now = '2026-10-04T04:00:00Z';
/** Shared daily fixture setup for the split regression suites. */
export const natal = computeBazi(birth, { now, yearsAround: 0 }),
  astro = computeAstrology(birth);
/** Shared daily fixture setup for the split regression suites. */
export const input: DailyInput = {
  birth,
  baziChart: natal,
  astroChart: astro,
  vedicChart: null,
  date: { local: '2026-10-04', tz: 'Asia/Shanghai' },
  seed: hashSeed('fixture-A|2026-10-04'),
};
/** Shared daily fixture setup for the split regression suites. */
export const daily = computeDaily(input);
/** Shared daily fixture setup for the split regression suites. */
export const base: DailyScoreContext = {
  god: 'bi_jian',
  strength: 'balanced',
  favorableHit: false,
  unfavorableHit: false,
  dayRelations: [],
  secondaryRelations: [],
  astro: { ...daily.astro, transits: [], retrogrades: [] },
  tarot: { card: 'major_00_fool', reversed: false },
};
/** Copy the fixed daily scoring context with an explicit test override.
 * @param patch Fields overridden for an isolated scoring-row assertion. */
export const emptyRulesContext = (patch: Partial<DailyScoreContext> = {}) => ({
  ...base,
  ...patch,
});
/** Build a daily transit fixture with a fixed 0.1-degree orb.
 * @param transiting Transit body identifier.
 * @param natal Natal body or angle identifier.
 * @param aspect Aspect identifier. */
export const transit = (
  transiting: DailyTransit['transiting'],
  natal: DailyTransit['natal'],
  aspect: DailyTransit['aspect'],
): DailyTransit => ({ transiting, natal, aspect, orb: 0.1, applying: false });
/** Return career/wealth/love/health/social score deltas for one scoring row.
 * @param rule Existing rule identifier.
 * @param context Fixed scoring inputs for the rule. */
export const deltaFor = (rule: string, context: DailyScoreContext) => {
  const row = DAILY_SCORE_RULES.find((r) => r.id === rule)!;
  const result = scoreDaily(context, [row]);
  return [
    result.scores.career,
    result.scores.wealth,
    result.scores.love,
    result.scores.health,
    result.scores.social,
  ].map((score) => score - 60);
};
/** Build a zero-latitude position fixture.
 * @param lon Longitude in degrees.
 * @param speed Angular speed in degrees per day. */
export const position = (lon: number, speed = 1): Position => ({
  lon,
  lat: 0,
  speed,
  retrograde: speed < 0,
});
