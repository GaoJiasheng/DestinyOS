// DESIGN-GAP: Explicit JSON import attributes let linked workspace modules run in native Node ESM as well as browser bundles.
import type { System } from '@tianji/shared';
import { resolvePath } from '@tianji/content';
import type { SystemConfig } from './types';
import { ziweiEmphasis } from './emphasis/evaluate';
import bazi from './plans/bazi.json' with { type: 'json' };
import ziwei from './plans/ziwei.json' with { type: 'json' };
import iching from './plans/iching.json' with { type: 'json' };
import qimen from './plans/qimen.json' with { type: 'json' };
import tarot from './plans/tarot.json' with { type: 'json' };
import astrology from './plans/astrology.json' with { type: 'json' };
import vedic from './plans/vedic.json' with { type: 'json' };
import numerology from './plans/numerology.json' with { type: 'json' };
import synastry from './plans/synastry.json' with { type: 'json' };
import daily from './plans/daily.json' with { type: 'json' };
// Natal bazi/astrology/vedic emphasis is planned for later phases; numerology, synastry
// and the divination/daily systems never get it (proposal Q3, Q9, Q10).
const deferred = { status: 'deferred' } as const;
const none = { status: 'not_applicable' } as const;
export const systemConfigs: Record<System, SystemConfig> = {
  bazi: {
    sectionPlan: bazi,
    emphasis: deferred,
    confidence: (chart) => numeric(chart, 'strength.confidence', 1),
    weightMultiplier: (_unit, chart) => numeric(chart, 'strength.confidence', 1),
  },
  ziwei: { sectionPlan: ziwei, emphasis: { status: 'available', compute: ziweiEmphasis } },
  iching: { sectionPlan: iching, emphasis: none },
  qimen: { sectionPlan: qimen, emphasis: none },
  tarot: { sectionPlan: tarot, emphasis: none },
  astrology: { sectionPlan: astrology, emphasis: deferred },
  vedic: { sectionPlan: vedic, emphasis: deferred },
  numerology: { sectionPlan: numerology, emphasis: none },
  daily: { sectionPlan: daily, emphasis: none },
  synastry: {
    sectionPlan: synastry,
    emphasis: none,
    confidence: (chart) => (resolvePath(chart, 'availability.complete')[0] === true ? 1 : 0.65),
  },
};
/** Read the first finite numeric chart-path value or return the supplied fallback.
 * @param chart Structured chart output.
 * @param path Documented JSONPath-lite field.
 * @param fallback Value used for missing or nonnumeric fields. */
export function numeric(chart: unknown, path: string, fallback: number): number {
  const value = resolvePath(chart, path)[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
// DESIGN-GAP: No per-chapter cap is specified in the tables; use six正文 KUs and three overview KUs.
// DESIGN-GAP: daily has no chapter keys; its plan follows its documented domains and supplemental readings.
// DESIGN-GAP: Systems other than bazi expose multiplier/confidence hooks until chart-specific rules are supplied.
