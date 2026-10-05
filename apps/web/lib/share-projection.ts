import { z } from 'zod';
import {
  NumerologyChartSchema,
  BaziChartSchema,
  AstroChartSchema,
  TarotChartSchema,
  IchingChartSchema,
  QimenChartSchema,
  ZiweiChartSchema,
  VedicChartSchema,
  type System,
  type Locale,
} from '@tianji/shared';
import type { Report } from '@tianji/interpret';
export const ShareTemplateSchema = z.enum(['chart', 'quote', 'daily']);
export type ShareTemplate = z.infer<typeof ShareTemplateSchema>;
export type PublicShare = {
  locale: Locale;
  system: System;
  template: ShareTemplate;
  revealLevel: number;
  headline: string;
  keywords: string[];
  scores: Report['headline']['scores'];
  diagram?: PublicDiagram;
  sections?: {
    title: string;
    text: string[];
    sources: { text: string; from: string }[];
    evidence: { label: string; value: string }[];
  }[];
  daily?: DailyCard;
};
export type PublicDiagram = {
  kind: 'pillars' | 'wheel' | 'cards' | 'hexagram' | 'grid';
  items: { label: string; value: string; longitude?: number; yang?: boolean }[];
};
// DESIGN-GAP: Template IDs are absent from 07; chart/quote/daily are stable internal IDs for the three documented templates.
/** Remove full dates and user placeholders from public prose; private input is never inspected. */
export function publicText(text: string): string {
  return text
    .replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[T ][\d:.+Z-]+)?\b/g, '[redacted]')
    .replace(/\d{4}年\d{1,2}月\d{1,2}日/g, '[redacted]')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '[redacted]');
}
/** Whitelist only derived diagram fields. Dates, question text, locations and input metadata cannot enter this projection. */
function diagram(system: System, chart: unknown): PublicDiagram | undefined {
  switch (system) {
    case 'numerology': {
      const c = NumerologyChartSchema.parse(chart);
      return {
        kind: 'grid',
        items: [{ label: 'numerology.lifePath', value: String(c.lifePath.number) }],
      };
    }
    case 'bazi': {
      const c = BaziChartSchema.parse(chart);
      return {
        kind: 'pillars',
        items: Object.entries(c.pillars).flatMap(([key, p]) =>
          p
            ? [
                {
                  label: `bazi.chart.${key}`,
                  value: `bazi.stems.${p.stem}|bazi.branches.${p.branch}`,
                },
              ]
            : [],
        ),
      };
    }
    case 'astrology': {
      const c = AstroChartSchema.parse(chart);
      return {
        kind: 'wheel',
        items: c.bodies.map((p) => ({
          label: `charts.planet.${p.key}`,
          value: `charts.sign.${p.sign}`,
          longitude: p.lon,
        })),
      };
    }
    case 'vedic': {
      const c = VedicChartSchema.parse(chart);
      return {
        kind: 'wheel',
        items: c.bodies.map((p) => ({
          label: `charts.graha.${p.key}`,
          value: `charts.sign.${p.sign}`,
          longitude: p.sidLon,
        })),
      };
    }
    case 'tarot': {
      const c = TarotChartSchema.parse(chart);
      return {
        kind: 'cards',
        items: c.cards.map((p) => ({
          label: `tarot.card.${p.cardKey}.name`,
          value: `tarot.${p.reversed ? 'reversed' : 'upright'}`,
        })),
      };
    }
    case 'iching': {
      const c = IchingChartSchema.parse(chart);
      return {
        kind: 'hexagram',
        items: c.primary.lines.map((y) => ({
          label: `divination.hexagrams.${c.primary.key}`,
          value: y ? 'divination.yang' : 'divination.yin',
          yang: y === 1,
        })),
      };
    }
    case 'qimen': {
      const c = QimenChartSchema.parse(chart);
      return {
        kind: 'grid',
        items: c.palaces.map((p) => ({ label: 'share.diagram', value: String(p.index) })),
      };
    }
    case 'ziwei': {
      const c = ZiweiChartSchema.parse(chart);
      return {
        kind: 'grid',
        items: c.palaces.map((p) => ({
          label: `ziwei.chart.palace.${p.key}`,
          value: `bazi.branches.${p.branch}`,
        })),
      };
    }
    default:
      return undefined;
  }
}
/** Single projection is shared by public HTML and OG; level zero includes no chart, report bodies or birth data. */
export function projectShare(
  system: System,
  chart: unknown,
  report: Report,
  template: ShareTemplate,
  revealLevel: number,
): PublicShare {
  const level = z.number().int().min(0).max(2).parse(revealLevel);
  return {
    locale: report.locale,
    system,
    template,
    revealLevel: level,
    headline: publicText(report.headline.persona),
    keywords: report.headline.keywords.map(publicText),
    scores: report.headline.scores,
    ...(level >= 1 ? { diagram: diagram(system, chart) } : {}),
    ...(level === 2
      ? {
          sections: report.sections.map((s) => ({
            title: publicText(s.title),
            sources: s.blocks.flatMap((b) =>
              b.type === 'sources'
                ? b.items.map((source) => ({
                    text: publicText(source.text),
                    from: publicText(source.from),
                  }))
                : [],
            ),
            evidence: s.blocks.flatMap((b) =>
              b.type === 'evidence'
                ? b.items
                    .filter((item) => !/(?:input|birth|place|local|name)/i.test(item.path))
                    .map((item) => ({
                      label: publicText(item.label),
                      value: publicText(item.value),
                    }))
                : [],
            ),
            text: s.blocks.flatMap((b) =>
              b.type === 'paragraph' || b.type === 'transition'
                ? [publicText(b.text)]
                : b.type === 'advice'
                  ? b.items.map(publicText)
                  : [],
            ),
          })),
        }
      : {}),
  };
}
export const DailyCardSchema = z
  .object({
    locale: z.enum(['zh', 'en', 'zh-TW']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    headline: z.string().max(240),
    stars: z.number().int().min(1).max(5),
    color: z.string().max(40),
    numbers: z.array(z.number().int().min(1).max(10)).max(2),
    do: z.array(z.string().max(40)).max(3),
    dont: z.array(z.string().max(40)).max(3),
  })
  .strict();
export type DailyCard = z.infer<typeof DailyCardSchema>;
