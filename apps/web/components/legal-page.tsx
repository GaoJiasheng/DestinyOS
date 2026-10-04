import { Fragment } from 'react';
import { getCopy } from '@/i18n/get-copy';
import { brand } from '@tianji/shared';
import type { MessageKey } from '@/i18n/catalog';
/** Render a deliberately small Markdown subset; raw HTML is never interpreted. */
export function LegalMarkdown({ text }: { text: string }) {
  return (
    <div className="legal-markdown">
      {text.split('\n').map((line, index) => {
        if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>;
        if (line.startsWith('- '))
          return (
            <ul key={index}>
              <li>{line.slice(2)}</li>
            </ul>
          );
        return line ? <p key={index}>{line}</p> : <Fragment key={index} />;
      })}
    </div>
  );
}
// DESIGN-GAP: Operator legal identity/contact are deployment configuration; missing values are disclosed rather than inventing a legal entity.
/** Render a bilingual legal document, shared brand and explicit policy update date. */
export async function LegalPage({
  page,
}: {
  page: 'privacy' | 'terms' | 'disclaimer' | 'credits' | 'about' | 'contact';
}) {
  const t = await getCopy();
  const controller =
    process.env.PRIVACY_CONTROLLER_NAME?.trim() || t('legal.controllerUnavailable');
  const email = process.env.PRIVACY_CONTACT_EMAIL?.trim() || t('legal.contactUnavailable');
  const title: MessageKey = page === 'credits' ? 'legal.attributions' : `legal.${page}`;
  const content =
    page === 'disclaimer'
      ? t('legal.disclaimer.full')
      : page === 'contact'
        ? t('legal.contact.body', { email })
        : page === 'about'
          ? t('legal.about.body')
          : t(`legal.${page}.markdown`, { controller, email, brand: brand.nameEn });
  return (
    <article className="settings-page">
      <h1 className="type-h1">{t(title)}</h1>
      <p>{t('legal.updated', { date: '2026-10-05' })}</p>
      <LegalMarkdown text={content} />
    </article>
  );
}
