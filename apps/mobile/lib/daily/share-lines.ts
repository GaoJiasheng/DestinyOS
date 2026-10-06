import type { MobileLocale } from '../i18n';
// DESIGN-GAP: Share text wraps at measured English word boundaries or Chinese code points.
/** Wrap measured canvas text without splitting English words or Unicode code points. */
export function shareLines(
  text: string,
  locale: MobileLocale,
  measure: (line: string) => number,
  width: number,
) {
  const lines: string[] = [];
  let current = '';
  for (const char of Array.from(text)) {
    if (current && measure(current + char) > width) {
      if (char === ' ') {
        lines.push(current.trimEnd());
        current = '';
        continue;
      }
      const boundary = locale === 'en' ? current.lastIndexOf(' ') : -1;
      if (boundary > 0) {
        lines.push(current.slice(0, boundary));
        current = current.slice(boundary + 1) + char;
      } else {
        lines.push(current);
        current = char;
      }
    } else current += char;
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines;
}
