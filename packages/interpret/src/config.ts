import type { System } from '@tianji/shared';
import { resolvePath } from '@tianji/content';
import type { SystemConfig } from './types';
import bazi from './plans/bazi.json';
import ziwei from './plans/ziwei.json';
import iching from './plans/iching.json';
import qimen from './plans/qimen.json';
import tarot from './plans/tarot.json';
import astrology from './plans/astrology.json';
import vedic from './plans/vedic.json';
import daily from './plans/daily.json';
export const systemConfigs: Record<System, SystemConfig> = {
  bazi: {
    sectionPlan: bazi,
    confidence: (chart) => numeric(chart, 'strength.confidence', 1),
    weightMultiplier: (_unit, chart) => numeric(chart, 'strength.confidence', 1),
  },
  ziwei: { sectionPlan: ziwei },
  iching: { sectionPlan: iching },
  qimen: { sectionPlan: qimen },
  tarot: { sectionPlan: tarot },
  astrology: { sectionPlan: astrology },
  vedic: { sectionPlan: vedic },
  daily: { sectionPlan: daily },
};
export function numeric(chart: unknown, path: string, fallback: number): number {
  const value = resolvePath(chart, path)[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
// DESIGN-GAP: No per-chapter cap is specified in the tables; use six正文 KUs and three overview KUs.
// DESIGN-GAP: daily has no chapter keys; its plan follows its documented domains and supplemental readings.
// DESIGN-GAP: Systems other than bazi expose multiplier/confidence hooks until chart-specific rules are supplied.
