import { type Graha, type VedicChart } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { computeVedic, detectYogas, YOGA_CONDITIONS } from '../src';
import { birth, now } from './astrology-fixtures';

describe('all twelve Yoga predicates: positive and negative examples', () => {
  const template = computeVedic(birth, now),
    lagna = {
      sidLon: 0,
      sign: 'aries' as const,
      nakshatra: 'ashwini' as const,
      pada: 1,
      navamsaSign: 'aries' as const,
    };
  function bodies(
    overrides: Partial<Record<Graha, Partial<VedicChart['bodies'][number]>>>,
  ): VedicChart['bodies'] {
    return template.bodies.map((b) => ({
      ...b,
      sign: 'gemini',
      house: 3,
      dignity: 'neutral',
      ...overrides[b.key],
    }));
  }
  const cases: Record<
    keyof typeof YOGA_CONDITIONS,
    {
      positive: Partial<Record<Graha, Partial<VedicChart['bodies'][number]>>>;
      negative: Partial<Record<Graha, Partial<VedicChart['bodies'][number]>>>;
    }
  > = {
    gajakesari: {
      positive: { chandra: { sign: 'aries' }, guru: { sign: 'cancer' } },
      negative: { chandra: { sign: 'aries' }, guru: { sign: 'taurus' } },
    },
    budha_aditya: {
      positive: { surya: { sign: 'aries' }, budha: { sign: 'aries' } },
      negative: { surya: { sign: 'aries' }, budha: { sign: 'taurus' } },
    },
    chandra_mangala: {
      positive: { chandra: { sign: 'aries' }, mangala: { sign: 'aries' } },
      negative: { chandra: { sign: 'aries' }, mangala: { sign: 'taurus' } },
    },
    ruchaka: {
      positive: { mangala: { house: 1, dignity: 'own' } },
      negative: { mangala: { house: 3, dignity: 'own' } },
    },
    bhadra: {
      positive: { budha: { house: 4, dignity: 'exalted' } },
      negative: { budha: { house: 4, dignity: 'enemy' } },
    },
    hamsa: {
      positive: { guru: { house: 7, dignity: 'moolatrikona' } },
      negative: { guru: { house: 6, dignity: 'own' } },
    },
    malavya: {
      positive: { shukra: { house: 10, dignity: 'own' } },
      negative: { shukra: { house: 2, dignity: 'own' } },
    },
    shasha: {
      positive: { shani: { house: 1, dignity: 'own' } },
      negative: { shani: { house: 1, dignity: 'debilitated' } },
    },
    raja_yoga: {
      positive: {},
      negative: {
        mangala: { sign: 'aries' },
        surya: { sign: 'leo' },
        guru: { sign: 'sagittarius' },
        chandra: { sign: 'cancer' },
        shukra: { sign: 'taurus' },
        shani: { sign: 'capricorn' },
      },
    },
    dhana_yoga: {
      positive: {},
      negative: {
        shukra: { sign: 'taurus' },
        shani: { sign: 'capricorn' },
        surya: { sign: 'leo' },
        guru: { sign: 'sagittarius' },
      },
    },
    kemadruma: {
      positive: { chandra: { sign: 'aries' } },
      negative: { chandra: { sign: 'aries' }, mangala: { sign: 'taurus' } },
    },
    neecha_bhanga: {
      positive: { surya: { sign: 'libra', dignity: 'debilitated' }, shukra: { house: 4 } },
      negative: { surya: { sign: 'libra', dignity: 'debilitated' }, shukra: { house: 3 } },
    },
  };
  it.each(Object.keys(YOGA_CONDITIONS) as (keyof typeof YOGA_CONDITIONS)[])(
    '%s detects positive and rejects negative',
    (key) => {
      expect(detectYogas(bodies(cases[key].positive), lagna).map((y) => y.key)).toContain(key);
      expect(detectYogas(bodies(cases[key].negative), lagna).map((y) => y.key)).not.toContain(key);
      expect(YOGA_CONDITIONS[key]).toBeTruthy();
    },
  );
  it('noon charts retain sign-only yogas with empty house evidence', () => {
    const result = detectYogas(
      bodies({ surya: { sign: 'aries' }, budha: { sign: 'aries' } }).map((b) => ({
        ...b,
        house: null,
      })),
      null,
    );
    expect(result.some((y) => y.key === 'budha_aditya')).toBe(true);
    expect(result.every((y) => y.houses.length === 0)).toBe(true);
    expect(result.some((y) => ['raja_yoga', 'dhana_yoga', 'neecha_bhanga'].includes(y.key))).toBe(
      false,
    );
  });

  describe('kemadruma formation and cancellations', () => {
    // Lagna Aries, Moon Taurus (house 2); Virgo (house 6) is neither beside the Moon nor in a
    // kendra from the Moon or the Lagna, so parking the five planets there forms the yoga.
    const base = (overrides: Partial<Record<Graha, Partial<VedicChart['bodies'][number]>>> = {}) =>
      bodies({
        chandra: { sign: 'taurus', house: 2 },
        surya: { sign: 'gemini', house: 3 },
        rahu: { sign: 'leo', house: 5 },
        ketu: { sign: 'aquarius', house: 11 },
        mangala: { sign: 'virgo', house: 6 },
        budha: { sign: 'virgo', house: 6 },
        guru: { sign: 'virgo', house: 6 },
        shukra: { sign: 'virgo', house: 6 },
        shani: { sign: 'virgo', house: 6 },
        ...overrides,
      });
    const has = (chart: VedicChart['bodies'], withLagna = true) =>
      detectYogas(chart, withLagna ? lagna : null).some((y) => y.key === 'kemadruma');
    const noon = (chart: VedicChart['bodies']) => chart.map((b) => ({ ...b, house: null }));

    it('forms when no classical planet is beside, with, or in a kendra from the Moon or Lagna', () => {
      // The Sun beside the Moon and the nodes in kendras from it neither form nor break the yoga.
      expect(has(base())).toBe(true);
      expect(detectYogas(base(), lagna).find((y) => y.key === 'kemadruma')).toEqual({
        key: 'kemadruma',
        bodies: ['chandra'],
        houses: [2],
      });
    });
    it('is not formed when a classical planet sits in the 2nd or 12th sign from the Moon', () => {
      expect(has(base({ budha: { sign: 'gemini', house: 3 } }))).toBe(false);
      expect(has(base({ shani: { sign: 'aries', house: 1 } }), false)).toBe(false);
    });
    it('is cancelled by a classical planet with the Moon', () => {
      expect(has(base({ shukra: { sign: 'taurus', house: 2 } }))).toBe(false);
      expect(has(noon(base({ shukra: { sign: 'taurus', house: 2 } })), false)).toBe(false);
    });
    it('is cancelled by a classical planet in a kendra from the Moon', () => {
      expect(has(base({ shani: { sign: 'leo', house: 5 } }))).toBe(false);
      expect(has(noon(base({ mangala: { sign: 'scorpio', house: 8 } })), false)).toBe(false);
    });
    it('is cancelled by a classical planet in a kendra from a known Lagna', () => {
      expect(has(base({ guru: { sign: 'cancer', house: 4 } }))).toBe(false);
      expect(has(base({ guru: { sign: 'capricorn', house: 10 } }))).toBe(false);
    });
    it('noon charts skip the Lagna cancellation and judge by the Moon alone', () => {
      expect(has(noon(base()), false)).toBe(true);
      expect(has(noon(base({ guru: { sign: 'cancer', house: 4 } })), false)).toBe(true);
      expect(detectYogas(noon(base()), null).find((y) => y.key === 'kemadruma')?.houses).toEqual(
        [],
      );
    });
  });
});
