import type { Section } from '@tianji/interpret';

// Mirrors apps/web/components/report/report-utils.ts so a folded chapter reads the same on both clients.
const MARKUP = /(\[\[term:[^\]]+\]\]|\*\*[^*]+\*\*|\[[^\]\n]+\]\(\/[^\s)]+\))/g;
const TOKEN = /^(\[\[term:|\*\*|\[[^\]\n]+\]\(\/)/;
const PREVIEW_LIMIT = 140;
// DESIGN-GAP: Knowledge-unit summaries are labels, not conclusions; a folded section quotes the first sentence of its own prose instead.
/** First sentence of a section's first paragraph, cut only between markup tokens; '' when there is none short enough. */
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
