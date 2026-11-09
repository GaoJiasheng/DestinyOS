import { hash } from './hash';
import type { GlossaryEntry, KnowledgeUnit, TransitionKind } from '@tianji/content';
import type { Locale } from '@tianji/shared';
import type { ReportBlock, Section } from './types';
type Evidence = { path: string; value: unknown; unit: KnowledgeUnit };
type EvidenceContext = {
  locale: Exclude<Locale, 'zh-TW'>;
  system: string;
  evidenceGlossary: GlossaryEntry[];
  display: (value: unknown) => string;
  substitute: (text: string, unit: KnowledgeUnit) => string;
};
/** Boolean evidence, alone or from a wildcard path, states that a chart predicate held. */
function isPredicate(value: unknown): boolean {
  return (
    typeof value === 'boolean' ||
    (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'boolean'))
  );
}
/** Pick transition templates deterministically, never repeating one within a report.
 * @param templates Locale transition templates grouped by kind. */
export function createTransitionChooser(templates: Record<TransitionKind, string[]>) {
  return (kind: TransitionKind, id: string, used: Set<string>): string | undefined => {
    const options = templates[kind];
    if (!options.length) throw new Error(`Empty transition templates: ${kind}`);
    const start = hash(id) % options.length;
    for (let i = 0; i < options.length; i++) {
      const text = options[(start + i) % options.length];
      if (text && !used.has(text)) {
        used.add(text);
        return text;
      }
    }
    // DESIGN-GAP: Exhausted templates produce a paragraph break instead of repeating a transition.
    return undefined;
  };
}
/** Build evidence chips; a boolean predicate shows the feature that fired, never a bare true/false. */
export function evidenceItems(
  evidence: Evidence[],
  { locale, system, evidenceGlossary, display, substitute }: EvidenceContext,
): Extract<ReportBlock, { type: 'evidence' }>['items'] {
  const named = new Set<string>();
  return evidence.flatMap((item) => {
    const leaf = item.path.split('.').at(-1) ?? item.path;
    const entry = evidenceGlossary.find((g) => g.key === item.path || g.key === leaf);
    // DESIGN-GAP: Anchors use URI-encoded paths; chart renderers can link to these exact stable IDs.
    const anchor = `chart:${encodeURIComponent(item.path)}`;
    if (system === 'daily' || !isPredicate(item.value)) {
      const value = display(item.value);
      return [{ label: entry?.[locale].term ?? value, path: item.path, value, anchor }];
    }
    // A false predicate must not name the absent term as if the chart had it.
    const name =
      item.value === true && entry
        ? entry[locale].term
        : substitute(item.unit[locale].title, item.unit);
    if (named.has(name)) return [];
    named.add(name);
    return [{ label: name, path: item.path, value: name, anchor }];
  });
}
/** Annotate glossary terms in a section's prose; one marker expands each term once per report. */
export function markSections(sections: Section[], mark: (text: string) => string): Section[] {
  for (const section of sections) {
    section.lead = mark(section.lead);
    for (const block of section.blocks) {
      if (block.type === 'paragraph') block.text = mark(block.text);
      else if (block.type === 'advice') block.items = block.items.map(mark);
    }
  }
  return sections;
}
