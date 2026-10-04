import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Lunar } from 'lunar-typescript';
import { Hexagram as ReferenceHexagram } from 'liuyao';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { IchingChartSchema, type Element, type Branch } from '@tianji/shared';
import {
  computeIching,
  hexagramByNumber,
  hexagramFromLines,
  hexagramFromTrigrams,
  mutualHexagram,
  changingHexagram,
  palaceFor,
  assignNaJia,
  sixSpirits,
  sixRelative,
  bodyUseRelation,
  seasonalStrength,
  selectMovingText,
  TRIGRAMS,
  TRIGRAM_ELEMENTS,
  NA_JIA,
  PALACE_TABLE,
  type IchingInput,
} from '../src/iching';
import { STEMS, BRANCHES, ELEMENTS } from '../src/common/ganzhi';
import { compute } from '../src';
const at = '2026-10-04T08:30[Asia/Shanghai]';
const cast = (
  numbers: number[],
  castBy: 'numbers' | 'random' | 'time' = 'numbers',
): IchingInput => ({
  method: 'meihua',
  category: 'other',
  seed: 'golden',
  meihua: { castBy, ...(numbers.length ? { numbers } : {}), at },
});
const liu = (throws: (0 | 1 | 2 | 3)[], category: IchingInput['category'] = 'other') =>
  computeIching({ method: 'liuyao', category, seed: 'golden', liuyao: { throws } }, at);
const chars = {
  qian: '乾',
  dui: '兑',
  li: '离',
  zhen: '震',
  xun: '巽',
  kan: '坎',
  gen: '艮',
  kun: '坤',
};
const stemChars = '甲乙丙丁戊己庚辛壬癸',
  branchChars = '子丑寅卯辰巳午未申酉戌亥';
const relativeChars = {
  xiong_di: '兄弟',
  fu_mu: '父母',
  zi_sun: '子孙',
  qi_cai: '妻财',
  guan_gui: '官鬼',
};
const elementChars = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
describe('iching documented casts and independent liuyao oracle', () => {
  it('implements normative body/use for the conflicting §9 example', () => {
    const c = computeIching(cast([3, 5]));
    expect(c.primary.number).toBe(50);
    expect(c.changing?.number).toBe(14);
    expect(c.movingLines).toEqual([1]);
    expect(c.meihua).toMatchObject({ body: 'li', use: 'xun', relation: 'use_generates_body' });
  });
  it('matches lunar 2026 sixth month fifteenth Wu-hour cast', () => {
    const solar = Lunar.fromYmd(2026, 6, 15).getSolar();
    const time = Temporal.ZonedDateTime.from({
      year: solar.getYear(),
      month: solar.getMonth(),
      day: solar.getDay(),
      hour: 12,
      timeZone: 'Asia/Shanghai',
    });
    const c = computeIching({ ...cast([], 'time'), meihua: { castBy: 'time', at: time } });
    expect(c.primary.number).toBe(55);
    expect(c.movingLines).toEqual([5]);
    expect(c.meihua?.numbers.source).toEqual([7, 6, 15, 7]);
  });
  it('matches Water over Lake changing to Wind over Water', () => {
    const c = liu([3, 1, 2, 2, 1, 0]);
    expect(c.primary.number).toBe(60);
    expect(c.changing?.number).toBe(59);
    expect(c.liuyao).toMatchObject({ palace: 'kan', palaceElement: 'water' });
    expect(c.liuyao?.lines[0]).toMatchObject({ stem: 'ding', branch: 'si', isShi: true });
  });
  it.each(Array.from({ length: 64 }, (_, i) => i + 1))(
    'cross-checks all installed lines for King Wen %i (exceeds 20 required casts)',
    (n) => {
      const g = hexagramByNumber(n),
        throws = g.lines.map((v) => (v ? 1 : 2)) as (1 | 2)[],
        ref = ReferenceHexagram.fromQuaternary(throws.join(''))!,
        c = liu(throws),
        palace = palaceFor(n);
      expect(ref.binary).toBe(g.lines.join(''));
      expect(ref.sign.codePointAt(0)! - 0x4dc0 + 1).toBe(n);
      expect(ref.palace).toBe(chars[palace.palace]);
      expect(ref.generation).toBe(palace.stage);
      expect(c.liuyao?.lines.find((l) => l.isShi)?.position).toBe(ref.host + 1);
      expect(c.liuyao?.lines.find((l) => l.isYing)?.position).toBe(ref.guest + 1);
      expect(
        c.liuyao?.lines.map(
          (l) =>
            relativeChars[l.relative] +
            stemChars[STEMS.indexOf(l.stem)] +
            branchChars[BRANCHES.indexOf(l.branch)] +
            elementChars[l.element],
        ),
      ).toEqual(ref.kins);
      expect(hexagramFromLines(g.lines)).toEqual(g);
      expect(hexagramFromTrigrams(g.upper, g.lower)).toEqual(g);
      expect(mutualHexagram(g).lines).toEqual([
        g.lines[1],
        g.lines[2],
        g.lines[3],
        g.lines[2],
        g.lines[3],
        g.lines[4],
      ]);
      expect(new Set(PALACE_TABLE.map((p) => p.number)).size).toBe(64);
    },
  );
  it.each(TRIGRAMS)('verifies 6 NaJia lines for %s', (trigram) => {
    const g = hexagramFromTrigrams(trigram, trigram);
    expect(assignNaJia(g, TRIGRAM_ELEMENTS[trigram]).map((l) => l.branch)).toEqual(
      NA_JIA[trigram].branches,
    );
  });
  it.each(STEMS.map((stem, i) => ({ stem, start: [0, 0, 1, 1, 2, 3, 4, 4, 5, 5][i]! })))(
    'six spirits for $stem',
    ({ stem, start }) => {
      const spirits = ['qing_long', 'zhu_que', 'gou_chen', 'teng_she', 'bai_hu', 'xuan_wu'];
      expect(sixSpirits(stem)).toEqual(
        Array.from({ length: 6 }, (_, i) => spirits[(i + start) % 6]),
      );
    },
  );
  it('tests all 25 body/use, relatives and seasonal combinations', () => {
    const relations = [
        'same',
        'body_generates_use',
        'body_controls_use',
        'use_controls_body',
        'use_generates_body',
      ],
      strength = ['prosperous', 'strong', 'dead', 'trapped', 'resting'],
      relatives = ['xiong_di', 'zi_sun', 'qi_cai', 'guan_gui', 'fu_mu'];
    for (const [a, body] of ELEMENTS.entries())
      for (const [b, use] of ELEMENTS.entries()) {
        const d = (b - a + 5) % 5;
        expect(bodyUseRelation(body, use)).toBe(relations[d]);
        expect(seasonalStrength(use, body)).toBe(strength[d]);
        expect(sixRelative(body, use)).toBe(relatives[d]);
      }
  });
  it.each([
    { m: [], source: 'primary', lines: [] },
    { m: [2], source: 'primary', lines: [2] },
    { m: [1, 4], source: 'primary', lines: [4] },
    { m: [6, 1, 3], source: 'primary', lines: [3] },
    { m: [1, 3, 5, 6], source: 'changing', lines: [2] },
    { m: [1, 2, 3, 4, 6], source: 'changing', lines: [5] },
    { m: [1, 2, 3, 4, 5, 6], source: 'changing', lines: [] },
  ])('selects text for $m', ({ m, source, lines }) =>
    expect(selectMovingText(m)).toMatchObject({ source, lines }),
  );
  it('has deterministic fair coin casts, static/all-moving, hidden relatives and changing relatives', () => {
    const random = { method: 'liuyao' as const, category: 'career' as const, seed: 'random' };
    expect(computeIching(random, at)).toEqual(computeIching(random, at));
    let old = 0;
    const total = 6000;
    for (let i = 0; i < 1000; i++) {
      const c = computeIching({ ...random, seed: `coin:${i}` }, at);
      old += c.movingLines.length;
      expect(IchingChartSchema.safeParse(c).success).toBe(true);
    }
    expect(old / total).toBeGreaterThan(0.22);
    expect(old / total).toBeLessThan(0.28);
    expect(liu([1, 1, 1, 1, 1, 1]).changing).toBeNull();
    expect(liu([3, 3, 3, 3, 3, 3]).changing?.number).toBe(2);
    for (let n = 1; n <= 64; n++) {
      const g = hexagramByNumber(n),
        c = liu(g.lines.map((v) => (v ? 3 : 0)));
      const present = new Set(c.liuyao!.lines.map((l) => l.relative));
      for (const hidden of c.liuyao!.hidden) expect(present.has(hidden.relative)).toBe(false);
      for (const l of c.liuyao!.lines)
        expect(l.changedTo?.relative).toBe(
          sixRelative(c.liuyao!.palaceElement, l.changedTo!.element),
        );
    }
  });
  it('validates all eight categories across 64 hexagrams and calendar months', () => {
    for (const category of [
      'career',
      'wealth',
      'love',
      'health',
      'study',
      'travel',
      'decision',
      'other',
    ] as const)
      for (let n = 1; n <= 64; n++) {
        const g = hexagramByNumber(n);
        const c = liu(
          g.lines.map((v) => (v ? 1 : 2)),
          category,
        );
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(100);
        expect(c.liuyao?.useGod.relative).toBeDefined();
        expect(c.liuyao!.findings.every((key) => !key.includes(':'))).toBe(true);
        expect(new Set(c.liuyao!.findings).size).toBe(c.liuyao!.findings.length);
      }
    for (let month = 1; month <= 12; month++)
      for (let u = 1; u <= 8; u++)
        for (let l = 1; l <= 8; l++) {
          const c = computeIching({
            ...cast([u, l, (month % 6) + 1]),
            meihua: {
              castBy: 'numbers',
              numbers: [u, l, (month % 6) + 1],
              at: `2026-${String(month).padStart(2, '0')}-15T12:00[Asia/Shanghai]`,
            },
          });
          expect(c.score).toBeGreaterThanOrEqual(0);
        }
  });
  it('handles random replay, zero remainder and three numbers independent of clock hour', () => {
    expect(computeIching(cast([], 'random'))).toEqual(computeIching(cast([], 'random')));
    expect(computeIching(cast([8, 16, 6])).movingLines).toEqual([6]);
    expect(computeIching(cast([8, 16, 6])).primary.number).toBe(2);
    expect(computeIching(cast([1, 2, 3])).movingLines).toEqual([3]);
  });
  it('rejects invalid boundaries and helper inputs', () => {
    for (const input of [
      { ...cast([0, 1]) },
      { ...cast([1, 2]), meihua: undefined },
      { ...cast([1, 2]), liuyao: { throws: [1, 1, 1, 1, 1, 1] } },
      { ...cast([1, 2]), meihua: { castBy: 'numbers', at } },
      { ...cast([1, 2]), meihua: { castBy: 'time', at: 'not-a-date' } },
      { ...cast([1, 2]), meihua: { castBy: 'time', at: '1800-01-01T12:00[UTC]' } },
    ])
      expect(() => computeIching(input as IchingInput)).toThrow();
    expect(() => computeIching({ method: 'liuyao', category: 'other', seed: 's' })).toThrow();
    expect(() => hexagramFromLines([2, 2, 2, 2, 2, 2])).toThrow();
    expect(() => hexagramByNumber(0)).toThrow();
    for (const m of [[0], [7], [1, 1]]) {
      expect(() => selectMovingText(m)).toThrow();
      expect(() => changingHexagram(hexagramByNumber(1), m)).toThrow();
    }
    expect(IchingChartSchema.safeParse({ ...liu([1, 1, 1, 1, 1, 1]), meihua: {} }).success).toBe(
      false,
    );
  });
  it('dispatches computed charts with normative school metadata', () => {
    const c = compute({
      system: 'iching',
      now: Temporal.ZonedDateTime.from(at),
      seed: 'fixed',
      question: cast([3, 5]),
    });
    expect(c.chart.primary).toMatchObject({ number: 50 });
    expect(c.meta.schoolUsed.method).toBe('meihua');
    expect(
      compute({
        system: 'iching',
        now: Temporal.ZonedDateTime.from(at),
        question: { method: 'liuyao', category: 'career', liuyao: { throws: [3, 1, 2, 2, 1, 0] } },
      }).chart.primary,
    ).toMatchObject({ number: 60 });
  });
  it('validates all 64 source records, 384 yao and xiang, and empty bilingual white-language fields', () => {
    const bilingual = z.object({ zh: z.literal(''), en: z.literal('') });
    const rows = z
      .array(
        z.object({
          number: z.number(),
          name: z.string().min(1),
          judgment: z.string().min(1),
          tuan: z.string().min(1),
          image: z.string().min(1),
          lines: z.array(z.number()).length(6),
          yao: z
            .array(
              z.object({
                original: z.string().min(1),
                image: z.string().min(1),
                meaning: bilingual,
              }),
            )
            .length(6),
          meaning: bilingual,
          guidance: z.record(bilingual),
          useNineSix: z.object({ original: z.string(), image: z.string() }).nullable(),
        }),
      )
      .length(64)
      .parse(parse(readFileSync('packages/content/iching/hexagrams.yaml', 'utf8')));
    rows.forEach((r, i) => {
      expect(r.number).toBe(i + 1);
      expect(r.lines).toEqual(hexagramByNumber(i + 1).lines);
      expect(Object.keys(r.guidance)).toHaveLength(8);
    });
    expect(new Set(rows.map((r) => r.number)).size).toBe(64);
    expect(rows[0]?.name).toBe('乾');
    for (const r of rows) for (const l of r.yao) expect(l.original).not.toMatch(/[A-Za-z（]/);
    expect(rows[6]?.yao).toHaveLength(6);
    expect(rows[0]?.useNineSix?.original).toContain('用九');
    expect(rows[1]?.useNineSix?.original).toContain('用六');
  });
});
// Compile-time checks keep shared enum references usable for consumers.
const _element: Element = 'water';
const _branch: Branch = 'zi';
void [_element, _branch];
