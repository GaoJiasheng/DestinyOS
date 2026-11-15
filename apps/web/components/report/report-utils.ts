import type { Report, Section } from '@tianji/interpret';
import { SCORE_DIMENSIONS } from '@tianji/ui-core';
import type { MessageKey } from '@/i18n/catalog';

/** Divination readings describe a draw or a cast, not a natal chart, so natal-only blocks are hidden. */
const DIVINATION = new Set(['tarot', 'iching', 'qimen']);
export function isDivination(system: string): boolean {
  return DIVINATION.has(system);
}

/** Heading for the chart card, named after what the system actually lays out. */
export function chartTitleKey(system: string): MessageKey {
  if (system === 'tarot') return 'report.chartTitle.tarot';
  if (system === 'iching') return 'report.chartTitle.iching';
  if (system === 'qimen') return 'report.chartTitle.qimen';
  return 'report.chart';
}

/** A radar of five identical scores carries no information, so it is only drawn when scores differ. */
export function hasScoreSpread(scores: Report['headline']['scores']): boolean {
  return new Set(SCORE_DIMENSIONS.map((dimension) => scores[dimension])).size > 1;
}

/** Zero-padded 24-hour clock, e.g. 09:05. */
export function formatClock(hour?: number | null, minute?: number | null): string {
  const pad = (value?: number | null) => String(value ?? 0).padStart(2, '0');
  return `${pad(hour)}:${pad(minute)}`;
}

/** Session-scoped reader preference for folding every report section at once. */
export const FOLD_PREFERENCE_KEY = 'tianji:report-folds';
export type FoldPreference = 'open' | 'closed';
export function readFoldPreference(): FoldPreference | null {
  try {
    const value = window.sessionStorage.getItem(FOLD_PREFERENCE_KEY);
    return value === 'open' || value === 'closed' ? value : null;
  } catch {
    return null;
  }
}
export function writeFoldPreference(value: FoldPreference): void {
  try {
    window.sessionStorage.setItem(FOLD_PREFERENCE_KEY, value);
  } catch {
    // Storage can be blocked; the toggle still works for this page view.
  }
}

const MARKUP = /(\[\[term:[^\]]+\]\]|\*\*[^*]+\*\*|\[[^\]\n]+\]\(\/[^\s)]+\))/g;
const TOKEN = /^(\[\[term:|\*\*|\[[^\]\n]+\]\(\/)/;
const PREVIEW_LIMIT = 140;
// DESIGN-GAP: Knowledge-unit summaries are labels ("辛金，中和：主动检验"), not conclusions; until the corpus is re-edited, a folded section and the one-page summary quote the first sentence of the section's own prose instead.
/** First sentence of a section's first paragraph, cut only between ReportText markup tokens; '' when there is none short enough. */
export function sectionPreview(section: Section): string {
  const paragraph = section.blocks.find((block) => block.type === 'paragraph');
  if (!paragraph || paragraph.type !== 'paragraph') return '';
  let preview = '';
  for (const part of paragraph.text.split(MARKUP)) {
    if (TOKEN.test(part)) {
      preview += part;
      continue;
    }
    const end = part.search(/[。！？!?]|\.(?=\s|$)/u);
    if (end >= 0) {
      preview += part.slice(0, end + 1);
      const sentence = preview.trim();
      return sentence.length <= PREVIEW_LIMIT && sentence !== section.lead.trim() ? sentence : '';
    }
    preview += part;
    if (preview.length > PREVIEW_LIMIT) return '';
  }
  return '';
}
