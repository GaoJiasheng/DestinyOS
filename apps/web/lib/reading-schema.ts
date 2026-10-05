import { z } from 'zod';
import { ReadingRequestSchema, System, EngineWarningSchema } from '@tianji/shared';
import {
  NumerologyChartSchema,
  BaziChartSchema,
  ZiweiChartSchema,
  IchingChartSchema,
  QimenChartSchema,
  TarotChartSchema,
  AstrologyChartSchema,
  VedicChartSchema,
  DailyChartSchema,
} from '@tianji/shared';
import type { Report } from '@tianji/interpret';
const source = z.object({ text: z.string(), from: z.string() });
const evidence = z.object({
  label: z.string(),
  path: z.string(),
  value: z.string(),
  anchor: z.string(),
});
const block = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('paragraph'),
    text: z.string(),
    unitId: z.string(),
    polarity: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  }),
  z.object({ type: z.literal('transition'), text: z.string() }),
  z.object({ type: z.literal('evidence'), items: z.array(evidence) }),
  z.object({ type: z.literal('advice'), items: z.array(z.string()) }),
  z.object({ type: z.literal('sources'), items: z.array(source) }),
  z.object({ type: z.literal('chart_ref'), component: z.string(), props: z.record(z.unknown()) }),
]);
const score = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export const ReportSchema: z.ZodType<Report> = z.object({
  system: z.nativeEnum(System),
  locale: z.enum(['zh', 'en']),
  knowledgeVersion: z.string(),
  engineVersion: z.string(),
  interpretVersion: z.string(),
  headline: z.object({
    persona: z.string(),
    keywords: z.array(z.string()),
    scores: z.object({ career: score, wealth: score, love: score, health: score, social: score }),
    confidence: z.number().min(0).max(1),
  }),
  sections: z.array(
    z.object({ key: z.string(), title: z.string(), lead: z.string(), blocks: z.array(block) }),
  ),
  hits: z.array(
    z.object({
      unitId: z.string(),
      weight: z.number(),
      section: z.string(),
      evidence: z.array(
        z.object({
          path: z.string(),
          value: z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.unknown()),
            z.record(z.unknown()),
          ]),
        }),
      ),
    }),
  ),
  doDont: z.object({ do: z.array(z.string()), dont: z.array(z.string()) }).optional(),
  readability: z.object({
    zhChars: z.number(),
    enWords: z.number(),
    termDensity: z.number(),
    passed: z.boolean(),
    issues: z.array(z.string()),
  }),
  disclaimerKey: z.string(),
});
export { ReadingRequestSchema };
export type ReadingRequest = z.infer<typeof ReadingRequestSchema>;
export const ReadingMetaSchema = z.object({
  schoolUsed: z.record(z.union([z.string(), z.number(), z.boolean()])),
  warnings: z.array(EngineWarningSchema),
  debug: z.record(z.unknown()).optional(),
});
export type ReadingMeta = z.infer<typeof ReadingMetaSchema>;
export type ReadingView = {
  id: string;
  system: System;
  createdAt: string;
  title: string | null;
  chart: unknown;
  report: Report;
  meta: ReadingMeta;
  birthYear?: number;
  displayName?: string;
  isPublic?: boolean;
  staleProfile?: boolean;
};
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: string } };
export type LocalReading = ReadingView & {
  request: ReadingRequest;
  reportZh?: Report;
  reportEn?: Report;
};

/** Validate chart snapshots against their system schema before importing or interpreting device data. */
export function parseReadingChart(system: System, chart: unknown): unknown {
  const schemas = {
    numerology: NumerologyChartSchema,
    bazi: BaziChartSchema,
    ziwei: ZiweiChartSchema,
    iching: IchingChartSchema,
    qimen: QimenChartSchema,
    tarot: TarotChartSchema,
    astrology: AstrologyChartSchema,
    vedic: VedicChartSchema,
    daily: DailyChartSchema,
  };
  return schemas[system].parse(chart);
}
