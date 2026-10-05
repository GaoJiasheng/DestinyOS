import { localeText } from '@tianji/shared/locale';
import type { Locale } from '@tianji/shared';
import type { Report, ReportBlock } from './types';
/** Convert only reader-visible report fields; evidence paths, IDs, chart props and hits stay intact. */
export function localizeReport(report: Report, locale: Locale): Report {
  if (report.locale === locale) return report;
  if (locale !== 'zh-TW' || report.locale === 'en')
    throw new Error('A Chinese source report is required');
  const text = (value: string) => localeText(value, locale);
  const block = (value: ReportBlock): ReportBlock => {
    switch (value.type) {
      case 'paragraph':
      case 'transition':
        return { ...value, text: text(value.text) };
      case 'advice':
        return { ...value, items: value.items.map(text) };
      case 'sources':
        return {
          ...value,
          items: value.items.map((item) => ({ text: text(item.text), from: text(item.from) })),
        };
      case 'evidence':
        return {
          ...value,
          items: value.items.map((item) => ({
            ...item,
            label: text(item.label),
            value: text(item.value),
          })),
        };
      case 'chart_ref':
        return value;
    }
  };
  return {
    ...report,
    locale,
    headline: {
      ...report.headline,
      persona: text(report.headline.persona),
      keywords: report.headline.keywords.map(text),
    },
    sections: report.sections.map((section) => ({
      ...section,
      title: text(section.title),
      lead: text(section.lead),
      blocks: section.blocks.map(block),
    })),
    doDont: report.doDont
      ? { do: report.doDont.do.map(text), dont: report.doDont.dont.map(text) }
      : undefined,
  };
}
