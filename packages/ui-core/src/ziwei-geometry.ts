import type { Branch, Palace, ZiweiChart } from '@tianji/shared';

/** Fixed traditional branch positions as zero-based [column, row] in a 4×4 chart. */
export const ZIWEI_POSITIONS: Record<Branch, readonly [number, number]> = {
  si: [0, 0],
  wu: [1, 0],
  wei: [2, 0],
  shen: [3, 0],
  chen: [0, 1],
  you: [3, 1],
  mao: [0, 2],
  xu: [3, 2],
  yin: [0, 3],
  chou: [1, 3],
  zi: [2, 3],
  hai: [3, 3],
};

/** Palace-order offsets for the two trines and opposition, including the selected palace. */
export function connectedPalaces(chart: ZiweiChart, index: number) {
  return [0, 4, 8, 6].map((offset) =>
    chart.palaces.find((p) => p.index === (index + offset) % 12)!,
  );
}

// DESIGN-GAP: Palace links follow §6's report topics; property and friends use the nearest related topic.
export const ZIWEI_SECTIONS: Record<Palace, string> = {
  life: 'life_palace',
  siblings: 'love_family',
  spouse: 'love_family',
  children: 'love_family',
  wealth: 'career_wealth',
  health: 'health_travel',
  travel: 'health_travel',
  friends: 'career_wealth',
  career: 'career_wealth',
  property: 'love_family',
  wellbeing: 'body_fortune',
  parents: 'love_family',
};

/** Resolve both numeric and named palace evidence paths against the saved chart. */
export function evidencePalace(chart: ZiweiChart, path?: string): number | undefined {
  if (!path) return undefined;
  const ref = /palaces(?:\[([^\]]+)\]|\.([^.[\]]+))/.exec(path);
  if (ref) {
    const key = (ref[1] ?? ref[2])?.replace(/['"]/g, '');
    return chart.palaces.find((p) => p.key === key || String(p.index) === key)?.index;
  }
  if (path.includes('horoscope.yearly')) return chart.horoscope.yearly.palaceIndex;
  if (path.includes('horoscope.decadal')) return chart.horoscope.decadal.palaceIndex;
  return undefined;
}
