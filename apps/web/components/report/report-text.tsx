'use client';
import { Fragment } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { TermChip } from './term-chip';
/** Render trusted bilingual prose as escaped React text; only term markers, emphasis and local links are recognized. */
export function ReportText({ text }: { text: string }) {
  const t = useCopy();
  return (
    <>
      {text
        .split(/(\[\[term:[^\]]+\]\]|\*\*[^*]+\*\*|\[[^\]\n]+\]\(\/[^\s)]+\))/g)
        .map((part, i) => {
          if (part.startsWith('[[term:')) return <TermChip key={i} termKey={part.slice(7, -2)} />;
          if (part.startsWith('**'))
            return <strong key={i}>{t('report.content', { text: part.slice(2, -2) })}</strong>;
          const link = part.match(/^\[([^\]]+)\]\((\/[^\s)]+)\)$/);
          if (link && !link[2]!.startsWith('//'))
            return (
              <a key={i} href={link[2]} className="text-link">
                {t('report.content', { text: link[1]! })}
              </a>
            );
          return <Fragment key={i}>{t('report.content', { text: part })}</Fragment>;
        })}
    </>
  );
}
