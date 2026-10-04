import { describe, expect, it } from 'vitest';
import { LunarUtil, Solar } from 'lunar-typescript';
import { Stem } from '@tianji/shared';
import {
  STEMS,
  BRANCHES,
  ELEMENTS,
  STEM_ELEMENTS,
  BRANCH_ELEMENTS,
  HIDDEN_STEMS,
  STEM_YIN_YANG,
  BRANCH_YIN_YANG,
  ganZhiAt,
  ganZhiIndex,
  SEXAGENARY_CYCLE,
  fiveTiger,
  fiveRat,
  hourBranch,
  tenGod,
  TEN_GOD_MATRIX,
  naYin,
  NA_YIN,
  lifeStage,
  LIFE_STAGES,
  voidBranches,
  VOID_BRANCHES,
  mod,
  branchRelations,
  branchTrines,
  BRANCH_COMBINATIONS,
  BRANCH_TRINES,
  BRANCH_CLASHES,
  BRANCH_HARMS,
  BRANCH_BREAKS,
  BRANCH_PUNISHMENTS,
  BRANCH_SELF_PUNISHMENTS,
  STEM_COMBINATIONS,
  STEM_CLASHES,
} from '../src';
const gan = '甲乙丙丁戊己庚辛壬癸',
  zhi = '子丑寅卯辰巳午未申酉戌亥';
const nayin =
  '海中金 炉中火 大林木 路旁土 剑锋金 山头火 涧下水 城头土 白蜡金 杨柳木 泉中水 屋上土 霹雳火 松柏木 长流水 沙中金 山下火 平地木 壁上土 金箔金 覆灯火 天河水 大驿土 钗钏金 桑柘木 大溪水 沙中土 天上火 石榴木 大海水'.split(
    ' ',
  );
const life = '长生 沐浴 冠带 临官 帝旺 衰 病 死 墓 绝 胎 养'.split(' ');
const gods = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
const godKeys = [
  'bi_jian',
  'jie_cai',
  'shi_shen',
  'shang_guan',
  'pian_cai',
  'zheng_cai',
  'qi_sha',
  'zheng_guan',
  'pian_yin',
  'zheng_yin',
];
describe('stem/branch foundations and complete matrices', () => {
  it('has canonical index ordering and unambiguous wu_stem', () => {
    expect(STEMS.join(' ')).toBe('jia yi bing ding wu_stem ji geng xin ren gui');
    expect(BRANCHES.join(' ')).toBe('zi chou yin mao chen si wu wei shen you xu hai');
    expect(ELEMENTS).toEqual(['wood', 'fire', 'earth', 'metal', 'water']);
    expect(STEMS.map((s) => STEM_ELEMENTS[s])).toEqual([
      'wood',
      'wood',
      'fire',
      'fire',
      'earth',
      'earth',
      'metal',
      'metal',
      'water',
      'water',
    ]);
    expect(BRANCHES.map((b) => BRANCH_ELEMENTS[b])).toEqual([
      'water',
      'earth',
      'wood',
      'wood',
      'earth',
      'fire',
      'fire',
      'earth',
      'metal',
      'metal',
      'earth',
      'water',
    ]);
    expect(STEMS.map((s) => STEM_YIN_YANG[s]).join(',')).toBe(
      'yang,yin,yang,yin,yang,yin,yang,yin,yang,yin',
    );
    expect(BRANCHES.map((b) => BRANCH_YIN_YANG[b]).join(',')).toBe(
      'yang,yin,yang,yin,yang,yin,yang,yin,yang,yin,yang,yin',
    );
    expect(BRANCHES.map((b) => HIDDEN_STEMS[b].map((s) => gan[STEMS.indexOf(s)]).join(''))).toEqual(
      [
        '癸',
        '己癸辛',
        '甲丙戊',
        '乙',
        '戊乙癸',
        '丙戊庚',
        '丁己',
        '己丁乙',
        '庚壬戊',
        '辛',
        '戊辛丁',
        '壬甲',
      ],
    );
  });
  it('round-trips all 60 pairs and rejects incompatible parity', () => {
    for (let i = 0; i < 60; i++) {
      const pair = ganZhiAt(i);
      expect(ganZhiIndex(pair.stem, pair.branch)).toBe(i);
      expect(ganZhiAt(i - 60)).toEqual(pair);
      expect(ganZhiAt(i + 60)).toEqual(pair);
    }
    expect(SEXAGENARY_CYCLE).toHaveLength(60);
    expect(() => ganZhiIndex('jia', 'chou')).toThrow();
    expect(() => ganZhiIndex('bad' as Stem, 'zi')).toThrow();
    expect(() => ganZhiAt(1.5)).toThrow();
    expect(() => mod(Infinity, 10)).toThrow();
    expect(() => mod(1, 0)).toThrow();
  });
  it('checks five-tiger and five-rat for every stem and all 12 branches against fixed rows', () => {
    const tiger = [
      '丙丁丙丁戊己庚辛壬癸甲乙',
      '戊己戊己庚辛壬癸甲乙丙丁',
      '庚辛庚辛壬癸甲乙丙丁戊己',
      '壬癸壬癸甲乙丙丁戊己庚辛',
      '甲乙甲乙丙丁戊己庚辛壬癸',
    ];
    const rat = [
      '甲乙丙丁戊己庚辛壬癸甲乙',
      '丙丁戊己庚辛壬癸甲乙丙丁',
      '戊己庚辛壬癸甲乙丙丁戊己',
      '庚辛壬癸甲乙丙丁戊己庚辛',
      '壬癸甲乙丙丁戊己庚辛壬癸',
    ];
    for (const [i, s] of STEMS.entries()) {
      expect(BRANCHES.map((b) => gan[STEMS.indexOf(fiveTiger(s, b))]).join('')).toBe(tiger[i % 5]);
      expect(BRANCHES.map((b) => gan[STEMS.indexOf(fiveRat(s, b))]).join('')).toBe(rat[i % 5]);
    }
    expect(Array.from({ length: 24 }, (_, h) => hourBranch(h))).toEqual([
      'zi',
      'chou',
      'chou',
      'yin',
      'yin',
      'mao',
      'mao',
      'chen',
      'chen',
      'si',
      'si',
      'wu',
      'wu',
      'wei',
      'wei',
      'shen',
      'shen',
      'you',
      'you',
      'xu',
      'xu',
      'hai',
      'hai',
      'zi',
    ]);
    for (const h of [-1, 24, 0.5]) expect(() => hourBranch(h)).toThrow();
  });
  it('cross-checks the 10×10 ten-god matrix with lunar-typescript independent lookup', () => {
    for (const [i, s] of STEMS.entries())
      for (const [j, t] of STEMS.entries()) {
        const expected = godKeys[gods.indexOf(LunarUtil.SHI_SHEN[`${gan[i]}${gan[j]}`]!)];
        expect(tenGod(s, t)).toBe(expected);
        expect(TEN_GOD_MATRIX[i]?.[j]).toBe(expected);
      }
  });
  it('checks every na-yin entry against traditional Chinese names and lunar lookup', () => {
    expect(NA_YIN).toHaveLength(60);
    for (let i = 0; i < 60; i++) {
      const pair = ganZhiAt(i);
      const chars = `${gan[i % 10]}${zhi[i % 12]}`;
      expect(LunarUtil.NAYIN[chars]).toBe(nayin[Math.floor(i / 2)]);
      expect(naYin(pair.stem, pair.branch)).toBe(NA_YIN[i]);
      expect(NA_YIN[i]).toBe(NA_YIN[i ^ 1]);
    }
    expect(naYin('geng', 'wu')).toBe('lu_pang_tu');
  });
  it('checks all 120 growth stages against lunar offsets and directions', () => {
    for (const [i, s] of STEMS.entries())
      for (const [j, b] of BRANCHES.entries()) {
        const offset = LunarUtil.CHANG_SHENG_OFFSET[gan[i]!]!;
        const index = (((offset + (i % 2 ? -j : j)) % 12) + 12) % 12;
        expect(life[LIFE_STAGES.indexOf(lifeStage(s, b))]).toBe(LunarUtil.CHANG_SHENG[index]);
      }
  });
  it('checks void branches for all 60 days against the lunar day API', () => {
    const seen = new Set<number>();
    for (let d = 1; d <= 60; d++) {
      const lunar = Solar.fromYmd(2000, 1, 1).next(d).getLunar();
      const stem = STEMS[lunar.getDayGanIndex()]!,
        branch = BRANCHES[lunar.getDayZhiIndex()]!;
      const index = ganZhiIndex(stem, branch);
      seen.add(index);
      expect(
        voidBranches(stem, branch)
          .map((b) => zhi[BRANCHES.indexOf(b)])
          .join(''),
      ).toBe(lunar.getDayXunKong());
    }
    expect(seen.size).toBe(60);
    expect(VOID_BRANCHES).toHaveLength(6);
  });
});
describe('all branch relation tables', () => {
  const chars = (groups: readonly (readonly string[])[]) =>
    groups.map((g) => g.map((b) => zhi[BRANCHES.indexOf(b as (typeof BRANCHES)[number])]).join(''));
  it('matches all canonical tables including punishments and overlaps', () => {
    expect(chars(BRANCH_COMBINATIONS)).toEqual(['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']);
    expect(chars(BRANCH_TRINES)).toEqual(['申子辰', '亥卯未', '寅午戌', '巳酉丑']);
    expect(chars(BRANCH_CLASHES)).toEqual(['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']);
    expect(chars(BRANCH_HARMS)).toEqual(['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌']);
    expect(chars(BRANCH_BREAKS)).toEqual(['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌']);
    expect(chars(BRANCH_PUNISHMENTS)).toEqual(['寅巳申', '丑戌未', '子卯']);
    expect(chars([BRANCH_SELF_PUNISHMENTS])).toEqual(['辰午酉亥']);
    expect(STEM_COMBINATIONS).toHaveLength(5);
    expect(STEM_CLASHES).toHaveLength(4);
  });
  it('checks all 144 ordered pairs against independently written Chinese membership sets', () => {
    const combine = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
    const trines = ['申子辰', '亥卯未', '寅午戌', '巳酉丑'];
    const clashes = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
    const harms = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
    const breaks = ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'];
    const punish = ['寅巳申', '丑戌未', '子卯'];
    for (const [i, a] of BRANCHES.entries())
      for (const [j, b] of BRANCHES.entries()) {
        const has = (table: string[]) =>
          i !== j && table.some((g) => g.includes(zhi[i]!) && g.includes(zhi[j]!));
        const expected = [];
        if (has(combine)) expected.push('combine');
        if (has(trines)) expected.push('tri_combine');
        if (has(clashes)) expected.push('clash');
        if (has(punish) || (i === j && '辰午酉亥'.includes(zhi[i]!))) expected.push('punish');
        if (has(harms)) expected.push('harm');
        if (has(breaks)) expected.push('break');
        expect(branchRelations(a, b)).toEqual(expected);
      }
    for (const group of BRANCH_TRINES) {
      expect(branchTrines(group)).toEqual([group]);
      expect(branchTrines(group.slice(0, 2))).toEqual([]);
    }
    expect(branchTrines(BRANCHES)).toEqual(BRANCH_TRINES);
    expect(branchTrines(['zi', 'zi', 'shen'])).toEqual([]);
  });
});
