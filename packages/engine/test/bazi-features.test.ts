import { type BaziChart, type Stem } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { BRANCHES, ganZhiAt, STEMS } from '../src';
import {
  assessStrength,
  detectPattern,
  elementDistribution,
  selectUseGod,
} from '../src/bazi/analysis';
import { computeFeatures } from '../src/bazi/features';
import { natalRelations } from '../src/bazi/relations';
import { computeShenSha, DAY_STEM_SHA, KUI_GANG, oppositeBranch } from '../src/bazi/shen-sha';
import { sample, synthetic } from './bazi-fixtures';
import A from './fixtures/bazi/A.json';

describe('markers, relations and precomputed KU boolean features', () => {
  it('checks every ten-stem marker cell and opposite-branch flying blade rule', () => {
    for (const [i, dm] of STEMS.entries())
      for (const b of BRANCHES) {
        const p = synthetic([
          ['jia', b === 'mao' ? 'yin' : 'zi'],
          [BRANCHES.indexOf(b) % 2 ? 'yi' : 'jia', b],
          [dm, BRANCHES[i % 2]!],
        ]);
        const hits = computeShenSha(p);
        for (const [name, table] of Object.entries(DAY_STEM_SHA))
          expect(hits.some((h) => h.name === name && h.hitsPillar.includes('month'))).toBe(
            table[i]!.includes(b),
          );
        expect(DAY_STEM_SHA.fei_ren[i]?.[0]).toBe(oppositeBranch(DAY_STEM_SHA.yang_ren[i]![0]!));
      }
  });
  it('collects all 20 families, checks exact魁罡 days and month-de stem/branch forms', () => {
    const names = new Set<string>();
    for (let i = 0; i < 60; i++)
      for (let m = 0; m < 12; m++) {
        const day = ganZhiAt(i),
          month = ganZhiAt(m),
          p = synthetic([
            [ganZhiAt(i + 2).stem, ganZhiAt(i + 2).branch],
            [month.stem, month.branch],
            [day.stem, day.branch],
            [ganZhiAt(i + 4).stem, ganZhiAt(i + 4).branch],
          ]);
        const hits = computeShenSha(p);
        hits.forEach((h) => names.add(h.name));
        expect(hits.some((h) => h.name === 'kui_gang')).toBe(
          KUI_GANG.some((k) => k === `${day.stem}:${day.branch}`),
        );
      }
    expect(names.size).toBe(20);
    const p = synthetic([
      ['ding', 'mao'],
      ['jia', 'yin'],
      ['jia', 'zi'],
      ['bing', 'yin'],
    ]);
    expect(computeShenSha(p)).toEqual(
      expect.arrayContaining([
        { name: 'tian_de_gui_ren', basedOn: 'month_branch', hitsPillar: ['year'] },
        { name: 'yue_de_gui_ren', basedOn: 'month_branch', hitsPillar: ['hour'] },
      ]),
    );
  });
  it('distinguishes half/full trines, duplicates, five stem combinations and four clashes', () => {
    const fire = sample([
      ['jia', 'yin'],
      ['bing', 'wu'],
      ['wu_stem', 'xu'],
      ['jia', 'yin'],
    ]);
    expect(
      fire.relations.branches.filter((r) => r.type === 'tri_combine' && r.complete),
    ).toHaveLength(2);
    expect(fire.features.san_he_huo_ju).toBe(true);
    const half = sample([
      ['jia', 'yin'],
      ['bing', 'wu'],
      ['wu_stem', 'chen'],
    ]);
    expect(half.features.san_he_huo_ju).toBe(false);
    expect(half.relations.branches.some((r) => r.type === 'tri_combine' && !r.complete)).toBe(true);
    for (const [a, b] of [
      ['jia', 'ji'],
      ['yi', 'geng'],
      ['bing', 'xin'],
      ['ding', 'ren'],
      ['wu_stem', 'gui'],
    ] as [Stem, Stem][])
      expect(
        natalRelations(
          synthetic([
            [a, BRANCHES[STEMS.indexOf(a) % 2]!],
            [b, BRANCHES[STEMS.indexOf(b) % 2]!],
            ['jia', 'zi'],
          ]),
        ).stems.some((r) => r.type === 'combine'),
      ).toBe(true);
    for (const [a, b] of [
      ['jia', 'geng'],
      ['yi', 'xin'],
      ['bing', 'ren'],
      ['ding', 'gui'],
    ] as [Stem, Stem][])
      expect(
        natalRelations(
          synthetic([
            [a, BRANCHES[STEMS.indexOf(a) % 2]!],
            [b, BRANCHES[STEMS.indexOf(b) % 2]!],
            ['jia', 'zi'],
          ]),
        ).stems.some((r) => r.type === 'clash'),
      ).toBe(true);
  });
  it('evaluates features from explicit evidence; coverage across representative symbolic configurations', () => {
    const seen = new Set<string>();
    // Exhaustive symbolic month/day samples plus deterministic cycles exercise both truth values of composite features.
    for (let i = 0; i < 60; i++)
      for (let j = 0; j < 12; j++) {
        const ps = [ganZhiAt(i), ganZhiAt(j), ganZhiAt(i + 20), ganZhiAt(i + j + 40)];
        const p = synthetic(ps.map((x) => [x.stem, x.branch])),
          strength = assessStrength(p),
          elements = elementDistribution(p);
        const partial = {
          ...A.chart,
          pillars: p,
          dayMaster: {
            stem: p.day.stem,
            element: p.day.stemElement,
            yinYang: STEMS.indexOf(p.day.stem) % 2 ? 'yin' : 'yang',
          },
          elements,
          strength,
          pattern: detectPattern(p, strength),
          useGod: selectUseGod(p, strength, elements),
          relations: natalRelations(p),
          shenSha: computeShenSha(p),
        } as Omit<BaziChart, 'features'>;
        const f = computeFeatures(partial);
        for (const [key, value] of Object.entries(f)) seen.add(`${key}:${value}`);
        expect(Object.values(f).every((v) => typeof v === 'boolean')).toBe(true);
        const gods = [
          ...p.year.hiddenStems,
          ...p.month.hiddenStems,
          ...p.day.hiddenStems,
          ...p.hour!.hiddenStems,
        ]
          .map((h) => h.tenGod)
          .concat(
            [p.year.tenGod, p.month.tenGod, p.hour!.tenGod].filter((g) => g !== 'day_master'),
          );
        expect(f.guan_sha_hun_za).toBe(gods.includes('zheng_guan') && gods.includes('qi_sha'));
        expect(f.has_root).toBe(
          [p.year, p.month, p.day, p.hour!].some((q) =>
            q.hiddenStems.some((h) => ['bi_jian', 'jie_cai'].includes(h.tenGod)),
          ),
        );
      }
    for (const key of [
      'guan_sha_hun_za',
      'cai_duo_shen_ruo',
      'bi_jian_heavy',
      'sha_yin_xiang_sheng',
      'has_clash',
      'has_punishment',
      'has_tao_hua',
      'has_yi_ma',
    ])
      expect(seen.has(`${key}:true`)).toBe(true);
    for (const [branches, key] of [
      [['shen', 'zi', 'chen'], 'san_he_shui_ju'],
      [['hai', 'mao', 'wei'], 'san_he_mu_ju'],
      [['si', 'you', 'chou'], 'san_he_jin_ju'],
    ] as const) {
      const p = synthetic(branches.map((b) => [BRANCHES.indexOf(b) % 2 ? 'yi' : 'jia', b]));
      expect(
        computeFeatures({ ...A.chart, pillars: p, relations: natalRelations(p) } as Omit<
          BaziChart,
          'features'
        >)[key],
      ).toBe(true);
    }
  });
});
