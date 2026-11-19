import type { Dim } from '../types';
/** Locales carried by compiled emphasis copy; zh-TW is generated from zh at build time. */
export type ScoringLocale = 'zh' | 'en' | 'zh-TW';
export type ScoringReliability = 'consensus' | 'school_split' | 'weak';
export type ScoringSource = 'self' | 'opposite';
export type ScoringBrightness = 'miao' | 'wang' | 'de' | 'li' | 'ping' | 'bu' | 'xian';
export type ScoringMutagen = 'lu' | 'quan' | 'ke' | 'ji';
/** Rule measures over one target palace (or its opposite); integer deltas are in `unit`ths. */
export type ScoringMeasure =
  | { kind: 'brightness'; from: ScoringSource; factor: number }
  | { kind: 'mutagen'; from: ScoringSource; deltas: Partial<Record<ScoringMutagen, number>> }
  | {
      kind: 'stars';
      from: ScoringSource;
      keys: string[];
      brightness?: ScoringBrightness[];
      each?: number;
      once?: number;
    }
  | { kind: 'combo'; from: ScoringSource; all: string[]; any: string[]; delta: number };
export type CompiledScoringRule = {
  id: string;
  code: string;
  reliability: ScoringReliability;
  dims?: Dim[];
  gate?: 'occupied' | 'empty';
  group?: string;
  measure: ScoringMeasure;
};
/** Locale-free rule data consumed by the interpret evaluator. */
export type CompiledScoringRules = {
  system: 'ziwei';
  scoringVersion: string;
  /** Integer scale: every stored delta, cap, clamp and cutpoint is multiplied by this. */
  unit: number;
  dims: Dim[];
  omitted: Dim[];
  palaceOf: Partial<Record<Dim, string>>;
  clamp: number;
  /** Three increasing level boundaries (schema-enforced length). */
  cutpoints: number[];
  brightnessScale: Record<ScoringBrightness, number>;
  groups: Record<string, { cap: number }>;
  rules: CompiledScoringRule[];
};
export type ScoringRuleCopy = {
  positive?: string;
  zero?: string;
  negative?: string;
  advice?: string;
};
export type ScoringLevelKey = '2' | '3' | '4' | '5';
export type ScoringLocaleCopy = {
  title: string;
  levels: Record<ScoringLevelKey, string>;
  dims: Partial<Record<Dim, { label: string; inline: string }>>;
  sentences: Partial<Record<Dim, Record<ScoringLevelKey, string>>>;
  overview: { two: string; one: string; none: string };
  footnotes: { disclaimer: string; health: string; crossSystem: string; brightness: string };
  rules: Record<string, ScoringRuleCopy>;
  /** Glossary terms keyed like `star.ju_men`, `palace.career`, `brightness.wang`, `mutagen.lu`. */
  terms: Record<string, string>;
};
/** Reader-facing emphasis copy, small enough to ship to the browser. */
export type CompiledScoringCopy = {
  system: 'ziwei';
  scoringVersion: string;
  locales: Record<ScoringLocale, ScoringLocaleCopy>;
};
