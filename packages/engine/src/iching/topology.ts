import { type Hexagram, type Trigram, type Element } from '@tianji/shared';
import { EngineError } from '../common/error';
import { elementDelta } from '../common/divination';
import { HEXAGRAM_DATA } from './hexagram-data';
// DESIGN-GAP: Hexagram key format is unspecified; hexagram_01…64 avoids duplicate pinyin homophones.
export const TRIGRAMS: readonly Trigram[] = [
  'qian',
  'dui',
  'li',
  'zhen',
  'xun',
  'kan',
  'gen',
  'kun',
];
export const TRIGRAM_LINES: Record<Trigram, readonly [0 | 1, 0 | 1, 0 | 1]> = {
  qian: [1, 1, 1],
  dui: [1, 1, 0],
  li: [1, 0, 1],
  zhen: [1, 0, 0],
  xun: [0, 1, 1],
  kan: [0, 1, 0],
  gen: [0, 0, 1],
  kun: [0, 0, 0],
};
export const TRIGRAM_ELEMENTS: Record<Trigram, Element> = {
  qian: 'metal',
  dui: 'metal',
  li: 'fire',
  zhen: 'wood',
  xun: 'wood',
  kan: 'water',
  gen: 'earth',
  kun: 'earth',
};
/** King Wen lookup for six bottom-to-top binary lines. */
export function hexagramFromLines(lines: readonly number[]): Hexagram {
  const data = HEXAGRAM_DATA.find((g) => g.lines.join('') === lines.join(''));
  if (!data || lines.length !== 6) throw new EngineError('E_INVALID_INPUT');
  return { ...data, lines: [...data.lines] };
}
/** King Wen lookup by canonical ordinal 1–64. */
export function hexagramByNumber(number: number): Hexagram {
  const data = HEXAGRAM_DATA[number - 1];
  if (!data) throw new EngineError('E_INVALID_INPUT');
  return { ...data, lines: [...data.lines] };
}
/** Build upper/lower trigram topology. */
export function hexagramFromTrigrams(upper: Trigram, lower: Trigram): Hexagram {
  return hexagramFromLines([...TRIGRAM_LINES[lower], ...TRIGRAM_LINES[upper]]);
}
/** Nuclear hexagram: lines 2/3/4 below and 3/4/5 above. */
export function mutualHexagram(primary: Hexagram): Hexagram {
  return hexagramFromLines([
    primary.lines[1],
    primary.lines[2],
    primary.lines[3],
    primary.lines[2],
    primary.lines[3],
    primary.lines[4],
  ]);
}
/** Flip the moving positions (1–6); a static cast has no changing hexagram. */
export function changingHexagram(primary: Hexagram, moving: readonly number[]): Hexagram | null {
  if (!moving.length) return null;
  if (
    new Set(moving).size !== moving.length ||
    moving.some((p) => !Number.isInteger(p) || p < 1 || p > 6)
  )
    throw new EngineError('E_INVALID_INPUT');
  return hexagramFromLines(primary.lines.map((l, i) => (moving.includes(i + 1) ? 1 - l : l)));
}
/** Body/use five-element relationship; body is the reference element. */
export function bodyUseRelation(body: Element, use: Element) {
  return (
    [
      'same',
      'body_generates_use',
      'body_controls_use',
      'use_controls_body',
      'use_generates_body',
    ] as const
  )[elementDelta(body, use)]!;
}
/** Month-command strength in spring/summer/late summer/autumn/winter. */
export function seasonalStrength(element: Element, season: Element) {
  return (['prosperous', 'strong', 'dead', 'trapped', 'resting'] as const)[
    elementDelta(season, element)
  ]!;
}
/** Multiple moving line rule from iching §7, returning the source hexagram and selected positions. */
export function selectMovingText(moving: readonly number[]): {
  source: 'primary' | 'changing';
  lines: number[];
  useNineSix: boolean;
} {
  if (
    new Set(moving).size !== moving.length ||
    moving.some((p) => !Number.isInteger(p) || p < 1 || p > 6)
  )
    throw new EngineError('E_INVALID_INPUT');
  const sorted = [...moving].sort((a, b) => a - b),
    still = [1, 2, 3, 4, 5, 6].filter((p) => !moving.includes(p));
  if (!moving.length) return { source: 'primary', lines: [], useNineSix: false };
  if (moving.length <= 3)
    return {
      source: 'primary',
      lines: [sorted[Math.floor(sorted.length / 2)]!],
      useNineSix: false,
    };
  if (moving.length < 6) return { source: 'changing', lines: [still[0]!], useNineSix: false };
  // DESIGN-GAP: §4/§7 specify changing judgment even for Qian/Kun all-moving; special use-nine/six remains available as content, not selected here.
  return { source: 'changing', lines: [], useNineSix: false };
}
