import type { DailyTransit } from '@tianji/shared';
import type { DailyScoreContext, DailyScoreRule } from './score-rules';
const transitKey = (t: DailyTransit) => `astro.transit.${t.transiting}_${t.aspect}_${t.natal}`;
const transits = (planet: string, natal: string[], aspects: string[]) => (c: DailyScoreContext) =>
  c.astro.transits
    .filter((t) => t.transiting === planet && natal.includes(t.natal) && aspects.includes(t.aspect))
    .map(transitKey);
const retrograde = (planet: 'mercury' | 'venus' | 'mars') => (c: DailyScoreContext) =>
  c.astro.retrogrades.includes(planet) ? [`astro.retrograde.${planet}`] : [];
const EASY = ['conjunction', 'trine', 'sextile'];
const HARD = ['opposition', 'square'];
/** Transit and retrograde rows; each planet pulls on the life areas it classically colors. */
export const SKY_SCORE_RULES: readonly DailyScoreRule[] = [
  {
    id: 'moon_support',
    theme: 'zheng_cai',
    driver: 'support',
    matches: transits('moon', ['venus', 'moon'], EASY),
    delta: { love: 8, health: 2, social: 4 },
  },
  {
    id: 'moon_sun_support',
    theme: 'shi_shen',
    driver: 'support',
    matches: transits('moon', ['sun'], EASY),
    delta: { career: 4, health: 4 },
  },
  {
    id: 'moon_tension',
    theme: 'pian_yin',
    driver: 'tension',
    matches: transits('moon', ['sun', 'moon'], HARD),
    delta: { career: -2, love: -4, health: -7, social: -2 },
  },
  {
    id: 'venus_support',
    theme: 'zheng_cai',
    driver: 'support',
    matches: transits('venus', ['sun', 'moon', 'venus'], EASY),
    delta: { wealth: 5, love: 9, social: 2 },
  },
  {
    id: 'venus_tension',
    theme: 'jie_cai',
    driver: 'tension',
    matches: transits('venus', ['sun', 'moon', 'venus'], HARD),
    delta: { wealth: -4, love: -6 },
  },
  {
    id: 'mercury_support',
    theme: 'shang_guan',
    driver: 'support',
    matches: transits('mercury', ['sun', 'moon', 'mercury'], EASY),
    delta: { career: 6, social: 5 },
  },
  {
    id: 'mercury_tension',
    theme: 'shang_guan',
    driver: 'tension',
    matches: transits('mercury', ['sun', 'moon', 'mercury'], HARD),
    delta: { career: -3, social: -5 },
  },
  {
    id: 'sun_support',
    theme: 'zheng_guan',
    driver: 'support',
    matches: transits('sun', ['sun', 'moon', 'mc'], EASY),
    delta: { career: 6, health: 3 },
  },
  {
    id: 'sun_tension',
    theme: 'qi_sha',
    driver: 'tension',
    matches: transits('sun', ['sun', 'moon', 'mc'], HARD),
    delta: { career: -3, health: -3 },
  },
  {
    id: 'mars_support',
    theme: 'qi_sha',
    driver: 'support',
    matches: transits('mars', ['sun', 'mars'], ['trine', 'sextile']),
    delta: { career: 6, health: 5 },
  },
  {
    id: 'mars_tension',
    theme: 'qi_sha',
    driver: 'tension',
    matches: transits('mars', ['sun', 'mars'], HARD),
    delta: { career: -3, health: -8, social: -5 },
  },
  {
    id: 'jupiter_support',
    theme: 'pian_cai',
    driver: 'support',
    matches: transits('jupiter', ['sun', 'moon', 'asc'], ['conjunction', 'trine']),
    delta: { career: 5, wealth: 10, social: 2 },
  },
  {
    id: 'saturn_tension',
    theme: 'zheng_guan',
    driver: 'tension',
    matches: transits('saturn', ['sun', 'moon', 'asc'], HARD),
    delta: { career: -8, love: -2, health: -4 },
  },
  {
    id: 'mercury_retrograde',
    theme: 'zheng_yin',
    driver: 'retrograde',
    matches: retrograde('mercury'),
    delta: { career: -3, social: -4 },
  },
  {
    id: 'venus_retrograde',
    theme: 'jie_cai',
    driver: 'retrograde',
    matches: retrograde('venus'),
    delta: { wealth: -3, love: -4 },
  },
  {
    id: 'mars_retrograde',
    theme: 'pian_yin',
    driver: 'retrograde',
    matches: retrograde('mars'),
    delta: { career: -2, health: -3 },
  },
];
