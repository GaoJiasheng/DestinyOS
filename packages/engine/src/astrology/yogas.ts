import { Graha, type VedicChart } from '@tianji/shared';
import { SIGNS } from './math';
import { VEDIC_LORDS } from './vedic-rules';
export const YOGA_CONDITIONS = {
  gajakesari: 'jupiter_in_kendra_from_moon',
  budha_aditya: 'sun_mercury_same_sign',
  chandra_mangala: 'moon_mars_same_sign',
  ruchaka: 'mars_strong_in_kendra',
  bhadra: 'mercury_strong_in_kendra',
  hamsa: 'jupiter_strong_in_kendra',
  malavya: 'venus_strong_in_kendra',
  shasha: 'saturn_strong_in_kendra',
  raja_yoga: 'distinct_kendra_trikona_lords_conjoined',
  dhana_yoga: 'wealth_trine_lords_conjoined',
  kemadruma: 'no_classical_planet_in_adjacent_moon_signs',
  neecha_bhanga: 'debilitation_dispositor_in_kendra',
} as const;
/** Twelve first-release Yoga predicates. Simplified rules are published as YOGA_CONDITIONS; no house-based claims for noon charts. */
export function detectYogas(
  bodies: VedicChart['bodies'],
  lagna: VedicChart['lagna'],
): VedicChart['yogas'] {
  // DESIGN-GAP: Raja/Dhana use conjunction of distinct functional lords; Neecha Bhanga uses dispositor in Lagna kendra; Kemadruma applies the basic adjacent-sign rule, ignoring Sun/nodes and advanced cancellations.
  const result: VedicChart['yogas'] = [],
    get = (key: Graha) => bodies.find((b) => b.key === key)!,
    moon = get('chandra'),
    sun = get('surya'),
    mercury = get('budha'),
    mars = get('mangala'),
    jupiter = get('guru');
  const add = (key: keyof typeof YOGA_CONDITIONS, group: VedicChart['bodies']) =>
    result.push({
      key,
      bodies: [...new Set(group.map((b) => b.key))],
      houses: [...new Set(group.flatMap((b) => (b.house === null ? [] : [b.house])))],
    });
  const relative = (a: VedicChart['bodies'][number], b: VedicChart['bodies'][number]) =>
    ((SIGNS.indexOf(a.sign) - SIGNS.indexOf(b.sign) + 12) % 12) + 1;
  const kendra = (house: number | null) => house !== null && [1, 4, 7, 10].includes(house);
  if (kendra(relative(jupiter, moon))) add('gajakesari', [moon, jupiter]);
  if (sun.sign === mercury.sign) add('budha_aditya', [sun, mercury]);
  if (moon.sign === mars.sign) add('chandra_mangala', [moon, mars]);
  const neighbours = bodies.filter(
    (b) =>
      !['surya', 'chandra', 'rahu', 'ketu'].includes(b.key) && [2, 12].includes(relative(b, moon)),
  );
  if (!neighbours.length) add('kemadruma', [moon]);
  if (!lagna) return result;
  const maha: readonly [Graha, keyof typeof YOGA_CONDITIONS][] = [
    ['mangala', 'ruchaka'],
    ['budha', 'bhadra'],
    ['guru', 'hamsa'],
    ['shukra', 'malavya'],
    ['shani', 'shasha'],
  ];
  for (const [planet, key] of maha) {
    const body = get(planet);
    if (kendra(body.house) && ['own', 'exalted', 'moolatrikona'].includes(body.dignity))
      add(key, [body]);
  }
  const lagnaSign = SIGNS.indexOf(lagna.sign),
    lord = (house: number) => VEDIC_LORDS[(lagnaSign + house - 1) % 12]!;
  const conjoined = (
    first: readonly number[],
    second: readonly number[],
    key: 'raja_yoga' | 'dhana_yoga',
  ) => {
    for (const h1 of first)
      for (const h2 of second) {
        const a = get(lord(h1)),
          b = get(lord(h2));
        if (a.key !== b.key && a.sign === b.sign) {
          add(key, [a, b]);
          return;
        }
      }
  };
  conjoined([1, 4, 7, 10], [5, 9], 'raja_yoga');
  conjoined([2, 11], [5, 9], 'dhana_yoga');
  const cancelled = bodies.filter(
    (b) => b.dignity === 'debilitated' && kendra(get(VEDIC_LORDS[SIGNS.indexOf(b.sign)]!).house),
  );
  if (cancelled.length) add('neecha_bhanga', cancelled);
  return result;
}
