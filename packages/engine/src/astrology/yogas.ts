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
  kemadruma: 'no_classical_planet_beside_moon_and_none_in_kendra_from_moon_or_lagna',
  neecha_bhanga: 'debilitation_dispositor_in_kendra',
} as const;
/** Twelve first-release Yoga predicates. Simplified rules are published as YOGA_CONDITIONS; no house-based claims for noon charts. */
export function detectYogas(
  bodies: VedicChart['bodies'],
  lagna: VedicChart['lagna'],
): VedicChart['yogas'] {
  // DESIGN-GAP: Raja/Dhana use conjunction of distinct functional lords; Neecha Bhanga uses dispositor in Lagna kendra; Kemadruma uses the adjacent-sign rule plus kendra cancellations only (see below).
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
  // Kemadruma is formed when none of Mars, Mercury, Jupiter, Venus or Saturn occupies the 2nd or
  // 12th sign from the Moon (Sun and nodes neither form nor break it). It is reported only when no
  // cancellation (Kemadruma Bhanga) applies. Adopted cancellations, the ones BPHS (Chandra yogas),
  // Saravali ch. 13, Phaladeepika ch. 6 and Brihat Jataka ch. 13 broadly share:
  //   1. one of those five planets with the Moon (1st sign from the Moon, which is itself a kendra);
  //   2. one of them in a kendra (1/4/7/10) from the Moon;
  //   3. with a known Lagna, one of them in a kendra from the Lagna (skipped for noon charts).
  // Jupiter's aspect on the Moon is left out: the engine has no graha-drishti model and the texts
  // disagree on it. Without these cancellations about 45% of random charts matched.
  const classical = bodies.filter((b) =>
    (['mangala', 'budha', 'guru', 'shukra', 'shani'] as Graha[]).includes(b.key),
  );
  const formed = !classical.some((b) => [2, 12].includes(relative(b, moon))),
    broken = classical.some(
      (b) => kendra(relative(b, moon)) || (lagna !== null && kendra(b.house)),
    );
  if (formed && !broken) add('kemadruma', [moon]);
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
