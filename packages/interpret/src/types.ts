import type { Locale, System } from '@tianji/shared';
import type {
  Dim,
  Evidence,
  KnowledgeBundle,
  KnowledgeUnit,
  Polarity,
  Source,
} from '@tianji/content';
export type Score = 1 | 2 | 3 | 4 | 5;
export type ReportBlock =
  | { type: 'paragraph'; text: string; unitId: string; polarity: Polarity }
  | { type: 'transition'; text: string }
  | { type: 'evidence'; items: { label: string; path: string; value: string; anchor: string }[] }
  | { type: 'advice'; items: string[] }
  | { type: 'sources'; items: Source[] }
  | { type: 'chart_ref'; component: string; props: Record<string, unknown> };
export type Section = { key: string; title: string; lead: string; blocks: ReportBlock[] };
export type Hit = { unitId: string; weight: number; section: string; evidence: Evidence[] };
export type Report = {
  system: System;
  locale: Locale;
  knowledgeVersion: string;
  engineVersion: string;
  interpretVersion: string;
  headline: { persona: string; keywords: string[]; scores: Record<Dim, Score>; confidence: number };
  sections: Section[];
  hits: Hit[];
  doDont?: { do: string[]; dont: string[] };
  readability: {
    zhChars: number;
    enWords: number;
    termDensity: number;
    passed: boolean;
    issues: string[];
  };
  disclaimerKey: string;
};
export type SectionSpec = {
  key: string;
  title: Record<Locale, string>;
  maxUnits: number;
  chartRef?: { component: string; props: Record<string, unknown> };
};
export type SectionPlan = SectionSpec[];
export type SystemConfig = {
  sectionPlan: SectionPlan;
  weightMultiplier?: (unit: KnowledgeUnit, chart: unknown) => number;
  baseScores?: (chart: unknown) => Partial<Record<Dim, number>>;
  confidence?: (chart: unknown) => number;
};
export type InterpretInput = {
  system: System;
  chart: unknown;
  locale: Locale;
  knowledge: KnowledgeBundle;
  context: {
    now: Date | string;
    profileHasTime: boolean;
    engineVersion?: string;
    userId?: string;
  };
  sectionPlan?: SectionPlan;
  config?: Partial<SystemConfig>;
};
