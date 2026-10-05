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
});
