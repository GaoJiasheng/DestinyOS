import type { Locale, System } from '@tianji/shared';
export type Polarity = 'positive' | 'negative' | 'neutral' | 'mixed';
export type Dim = 'career' | 'wealth' | 'love' | 'health' | 'social';
export const dimensions: Dim[] = ['career', 'wealth', 'love', 'health', 'social'];
export type Condition = { path: string } & (
  | { eq: unknown }
  | { in: unknown[] }
  | { gte: number }
  | { lte: number }
  | { contains: unknown }
  | { exists: boolean }
);
export type When = Condition | { all: When[] } | { any: When[] } | { not: When };
export type Evidence = { path: string; value: unknown };
export type Source = { text: string; from: string };
export type LocalizedUnit = {
  title: string;
  summary: string;
  body: string;
  advice: string[];
  do: string[];
  dont: string[];
  sources?: Source[];
};
export type KnowledgeUnit = {
  id: string;
  system: System | 'common';
  section: string;
  topic: string;
  when: When;
  weight: number;
  polarity: Polarity;
  tags: string[];
  exclusive_with: string[];
  scores?: Partial<Record<Dim, number>>;
  variables?: Record<string, string>;
  zh: LocalizedUnit;
  en: LocalizedUnit;
  meta: {
    author: string;
    reviewed_by: string | null;
    version: number;
    status: 'draft' | 'published' | 'deprecated';
  };
};
// DESIGN-GAP: Expanded appendix ranges use conventional snake_case keys; qimen.star.tian_fu avoids the Zi Wei star.tian_fu collision.
export type GlossaryText = {
  term: string;
  short: string;
  long: string;
  pinyin?: string;
  colors?: string;
};
export type GlossaryEntry = {
  key: string;
  system: System | 'common';
  zh: GlossaryText;
  en: GlossaryText;
  aliases: string[];
};
export type TransitionKind =
  'continuation' | 'concession' | 'evidence' | 'advice' | 'low_confidence';
export type Transitions = Record<Locale, Record<TransitionKind, string[]>>;
export type KnowledgeBundle = {
  knowledgeVersion: string;
  units: KnowledgeUnit[];
  glossary: GlossaryEntry[];
  transitions: Transitions;
};
export type CompiledBundle = KnowledgeBundle & {
  system: System | 'common';
  locale: Locale;
  index: {
    byId: Record<string, number>;
    bySection: Record<string, number[]>;
    byTopic: Record<string, number[]>;
  };
};
