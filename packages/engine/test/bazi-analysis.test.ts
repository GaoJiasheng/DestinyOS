import { type BaziChart, type Branch, type Stem } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { BRANCHES, STEMS } from '../src';
import {
  assessStrength,
  detectPattern,
  elementDistribution,
  selectUseGod,
} from '../src/bazi/analysis';
import { sample, synthetic } from './bazi-fixtures';
import A from './fixtures/bazi/A.json';

describe('hand-calculated weighted_v1, use god and simplified patterns', () => {
  it.each([
    {
      pairs: [
        ['jia', 'zi'],
        ['jia', 'zi'],
        ['jia', 'zi'],
        ['jia', 'zi'],
      ],
      score: 10,
      level: 'strong',
    },
    {
      pairs: [
        ['jia', 'wu'],
        ['jia', 'wu'],
        ['jia', 'wu'],
        ['jia', 'wu'],
      ],
      score: -2,
      level: 'balanced',
    },
    {
      pairs: [
        ['jia', 'chen'],
        ['jia', 'chen'],
        ['jia', 'chen'],
        ['jia', 'chen'],
      ],
      score: 3.9,
      level: 'strong',
    },
    {
      pairs: [
        ['geng', 'shen'],
        ['geng', 'shen'],
        ['geng', 'shen'],
        ['geng', 'shen'],
      ],
      score: 8.9,
      level: 'strong',
    },
    {
      pairs: [
        ['geng', 'shen'],
        ['geng', 'shen'],
        ['jia', 'wu'],
        ['geng', 'shen'],
      ],
      score: -6.4,
      level: 'weak',
    },
    {
      pairs: [
        ['jia', 'wu'],
        ['jia', 'wu'],
        ['jia', 'wu'],
      ],
      score: -1.5,
      level: 'balanced',
    },
  ])('matches score $score/$level with per-source evidence', ({ pairs, score, level }) => {
    const p = synthetic(pairs as [Stem, Branch][]),
      strength = assessStrength(p);
    expect(strength.score).toBeCloseTo(score, 8);
    expect(strength.level).toBe(level);
    expect(strength.details.reduce((n, d) => n + d.score, 0)).toBeCloseTo(score, 8);
    expect(strength.confidence).toBeCloseTo(
      1 - (p.hour ? 0 : 0.3) - (level === 'balanced' ? 0.15 : 0),
    );
  });
  it('uses winter fire/summer water as independent tags without changing strong/weak preferences', () => {
    const winter = sample([
      ['jia', 'zi'],
      ['jia', 'zi'],
      ['jia', 'zi'],
      ['jia', 'zi'],
    ]);
    expect(winter.useGod).toMatchObject({
      group: 'drain',
      favorable: ['fire', 'earth', 'metal'],
      tiaoHou: 'fire',
    });
    const summer = sample([
      ['jia', 'wu'],
      ['jia', 'wu'],
      ['jia', 'wu'],
      ['jia', 'wu'],
    ]);
    expect(summer.useGod).toMatchObject({
      group: 'balance',
      favorable: ['water'],
      tiaoHou: 'water',
    });
    const weak = sample([
      ['geng', 'shen'],
      ['geng', 'shen'],
      ['jia', 'wu'],
      ['geng', 'shen'],
    ]);
    expect(weak.useGod).toMatchObject({ group: 'support', favorable: ['wood', 'water'] });
    expect(weak.features.suspected_cong).toBe(true);
    const temperate = synthetic([
      ['jia', 'yin'],
      ['jia', 'yin'],
      ['jia', 'zi'],
    ]);
    const allElements = elementDistribution(temperate);
    expect(
      selectUseGod(temperate, { ...winter.strength, level: 'balanced' }, allElements).favorable,
    ).toHaveLength(5);
  });
  it('flags a lone unsupported day master weak', () => {
    const p = synthetic([
      ['bing', 'wu'],
      ['bing', 'wu'],
      ['ren', 'wu'],
    ]);
    const s = assessStrength(p);
    expect(s.level).toBe('weak');
  });
  it('sets 10 pattern names from month main qi, visible exposure and confidence with no hour', () => {
    const cases: readonly [Stem, Branch, BaziChart['pattern']['name']][] = [
      ['jia', 'yin', 'jian_lu'],
      ['jia', 'mao', 'yue_ren'],
      ['jia', 'si', 'shi_shen'],
      ['jia', 'wu', 'shang_guan'],
      ['jia', 'chen', 'pian_cai'],
      ['jia', 'chou', 'zheng_cai'],
      ['jia', 'shen', 'qi_sha'],
      ['jia', 'you', 'zheng_guan'],
      ['jia', 'hai', 'pian_yin'],
      ['jia', 'zi', 'zheng_yin'],
    ];
    for (const [dm, month, name] of cases) {
      const branch = BRANCHES[STEMS.indexOf(dm) % 2]!;
      const p = synthetic([
        ['jia', 'zi'],
        [BRANCHES.indexOf(month) % 2 ? 'yi' : 'jia', month],
        [dm, branch],
      ]);
      expect(detectPattern(p, assessStrength(p)).name).toBe(name);
    }
    expect(A.chart.pattern.viaStem).toBe(false);
    expect(
      sample([
        ['jia', 'yin'],
        ['jia', 'yin'],
        ['jia', 'zi'],
      ]).pattern.viaStem,
    ).toBe(true);
  });
});
