import {
  type Branch,
  type Stem,
  type Trigram,
  type SixRelative,
  type SixSpirit,
  type Element,
  type Hexagram,
  type IchingChart,
} from '@tianji/shared';
import { BRANCH_ELEMENTS, STEMS, voidBranches } from '../common/ganzhi';
import { elementDelta, clampScore } from '../common/divination';
import { TRIGRAM_LINES, TRIGRAM_ELEMENTS, TRIGRAMS, hexagramFromLines } from './topology';
export const NA_JIA: Record<
  Trigram,
  { stems: readonly [Stem, Stem]; branches: readonly Branch[] }
> = {
  qian: { stems: ['jia', 'ren'], branches: ['zi', 'yin', 'chen', 'wu', 'shen', 'xu'] },
  kun: { stems: ['yi', 'gui'], branches: ['wei', 'si', 'mao', 'chou', 'hai', 'you'] },
  zhen: { stems: ['geng', 'geng'], branches: ['zi', 'yin', 'chen', 'wu', 'shen', 'xu'] },
  xun: { stems: ['xin', 'xin'], branches: ['chou', 'hai', 'you', 'wei', 'si', 'mao'] },
  kan: { stems: ['wu_stem', 'wu_stem'], branches: ['yin', 'chen', 'wu', 'shen', 'xu', 'zi'] },
  li: { stems: ['ji', 'ji'], branches: ['mao', 'chou', 'hai', 'you', 'wei', 'si'] },
  gen: { stems: ['bing', 'bing'], branches: ['chen', 'wu', 'shen', 'xu', 'zi', 'yin'] },
  dui: { stems: ['ding', 'ding'], branches: ['si', 'mao', 'chou', 'hai', 'you', 'wei'] },
};
export const RELATIVES: readonly SixRelative[] = [
  'xiong_di',
  'zi_sun',
  'qi_cai',
  'guan_gui',
  'fu_mu',
];
export const SPIRITS: readonly SixSpirit[] = [
  'qing_long',
  'zhu_que',
  'gou_chen',
  'teng_she',
  'bai_hu',
  'xuan_wu',
];
/** Six relatives referenced to the primary palace's element, including changing lines. */
export function sixRelative(palace: Element, line: Element): SixRelative {
  return RELATIVES[elementDelta(palace, line)]!;
}
/** Six spirits from the day's heavenly stem, ascending from the first line. */
export function sixSpirits(stem: Stem): SixSpirit[] {
  const start = [0, 0, 1, 1, 2, 3, 4, 4, 5, 5][STEMS.indexOf(stem)]!;
  return Array.from({ length: 6 }, (_, i) => SPIRITS[(start + i) % 6]!);
}
// Eight palace changes: pure, 1/2/3/4/5世, 游魂 (undo 4), 归魂 (undo lower trigram).
export const PALACE_TABLE = TRIGRAMS.flatMap((palace) => {
  let lines: number[] = [...TRIGRAM_LINES[palace], ...TRIGRAM_LINES[palace]];
  return Array.from({ length: 8 }, (_, stage) => {
    if (stage >= 1 && stage <= 5) lines = lines.map((v, i) => (i === stage - 1 ? 1 - v : v));
    if (stage === 6) lines = lines.map((v, i) => (i === 3 ? 1 - v : v));
    if (stage === 7) lines = lines.map((v, i) => (i < 3 ? 1 - v : v));
    const shi = [6, 1, 2, 3, 4, 5, 4, 3][stage]!;
    return {
      number: hexagramFromLines(lines).number,
      palace,
      stage,
      shi,
      ying: ((shi + 2) % 6) + 1,
    };
  });
});
/** Eight-palace membership plus Shi/Ying positions for a King Wen hexagram. */
export function palaceFor(number: number) {
  return PALACE_TABLE.find((g) => g.number === number)!;
}
/** Jing Fang stems/branches in bottom-to-top order. */
export function assignNaJia(hexagram: Hexagram, palaceElement: Element) {
  return hexagram.lines.map((_, i) => {
    const trigram = i < 3 ? hexagram.lower : hexagram.upper;
    const table = NA_JIA[trigram],
      branch = table.branches[i]!;
    return {
      stem: table.stems[i < 3 ? 0 : 1],
      branch,
      element: BRANCH_ELEMENTS[branch],
      relative: sixRelative(palaceElement, BRANCH_ELEMENTS[branch]),
    };
  });
}
/** Install all six lines, hidden relatives and category use-god; no IO or clock access. */
export function installLiuyao(
  primary: Hexagram,
  changing: Hexagram | null,
  moving: number[],
  throws: (0 | 1 | 2 | 3)[],
  day: { stem: Stem; branch: Branch },
  month: Branch,
  category: IchingChart['category'],
) {
  const palace = palaceFor(primary.number),
    palaceElement = TRIGRAM_ELEMENTS[palace.palace],
    spirits = sixSpirits(day.stem),
    changed = changing ? assignNaJia(changing, palaceElement) : null;
  const lines = assignNaJia(primary, palaceElement).map((line, i) => ({
    ...line,
    position: i + 1,
    yang: primary.lines[i] === 1,
    moving: moving.includes(i + 1),
    spirit: spirits[i]!,
    isShi: palace.shi === i + 1,
    isYing: palace.ying === i + 1,
    ...(moving.includes(i + 1) && changed ? { changedTo: changed[i]! } : {}),
  }));
  const pure = hexagramFromLines([
    ...TRIGRAM_LINES[palace.palace],
    ...TRIGRAM_LINES[palace.palace],
  ]);
  const hidden = assignNaJia(pure, palaceElement).flatMap((line, i) =>
    lines.some((l) => l.relative === line.relative)
      ? []
      : [{ relative: line.relative, stem: line.stem, branch: line.branch, underLine: i + 1 }],
  );
  // DESIGN-GAP: Input has no partner gender; love uses Ying for a general relationship question. Other/general uses Shi.
  const relative: SixRelative =
    ({ career: 'guan_gui', wealth: 'qi_cai', study: 'fu_mu' } as const)[
      category as 'career' | 'wealth' | 'study'
    ] ?? lines[(category === 'love' ? palace.ying : palace.shi) - 1]!.relative;
  const selected =
    category === 'love'
      ? [palace.ying]
      : ['health', 'travel', 'decision', 'other'].includes(category)
        ? [palace.shi]
        : lines.filter((l) => l.relative === relative).map((l) => l.position);
  const voids = [...voidBranches(day.stem, day.branch)],
    findings: string[] = [];
  // DESIGN-GAP: Multiple use-gods are all reported; average strength avoids counting duplicate relatives twice.
  const values = selected.map((pos) => {
    const l = lines[pos - 1]!;
    let weight = 0;
    for (const [key, branch] of [
      ['month', month],
      ['day', day.branch],
    ] as const) {
      const delta = elementDelta(BRANCH_ELEMENTS[branch], l.element);
      if (delta === 0 || delta === 1) {
        weight += 2;
        findings.push(`${key}_supports`);
      }
      if (delta === 2) {
        weight -= 2;
        findings.push(`${key}_controls`);
      }
    }
    if (voids.includes(l.branch)) {
      weight -= 3;
      findings.push('void');
    }
    if (l.moving) {
      weight += 1;
      findings.push('moving');
      const delta = elementDelta(l.changedTo!.element, l.element);
      if (delta === 1) {
        weight += 2;
        findings.push('return_generated');
      }
      if (delta === 2) {
        weight -= 2;
        findings.push('return_controlled');
      }
    }
    return weight;
  });
  const value = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const hasHidden = hidden.some((h) => h.relative === relative);
  const state: NonNullable<IchingChart['liuyao']>['useGod']['state'] = !selected.length
    ? hasHidden
      ? 'hidden'
      : 'absent'
    : selected.every((pos) => voids.includes(lines[pos - 1]!.branch))
      ? 'void'
      : value >= 2
        ? 'strong'
        : value <= -2
          ? 'weak'
          : 'neutral';
  if (!selected.length) findings.push(state);
  if (category === 'health')
    findings.push(...lines.filter((l) => l.relative === 'guan_gui').map(() => 'illness'));
  if (category === 'study')
    findings.push(...lines.filter((l) => l.relative === 'guan_gui').map(() => 'rank'));
  if (category === 'travel')
    findings.push('ying', ...lines.filter((l) => l.relative === 'fu_mu').map(() => 'vehicle'));
  if (category === 'decision')
    findings.push(
      (
        [
          'shi_ying_same',
          'shi_generates_ying',
          'shi_controls_ying',
          'ying_controls_shi',
          'ying_generates_shi',
        ] as const
      )[elementDelta(lines[palace.shi - 1]!.element, lines[palace.ying - 1]!.element)]!,
    );
  return {
    chart: {
      throws,
      lines,
      palace: palace.palace,
      palaceElement,
      hidden,
      useGod: { relative, lines: selected, state },
      voidBranches: voids,
      findings: [...new Set(findings)],
    },
    score: clampScore(50 + value * 7 + (state === 'absent' ? -14 : state === 'hidden' ? -7 : 0)),
  };
}
