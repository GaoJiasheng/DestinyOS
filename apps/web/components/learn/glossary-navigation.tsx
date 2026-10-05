import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { learnContent } from '@/lib/learn';
/** Group compiled glossary entries without renaming their source keys or URL slugs. */
export async function GlossaryNavigation({ locale }: { locale: 'zh' | 'en' | 'zh-TW' }) {
  const content = await learnContent(locale);
  const t = await getCopy();
  const groups = [
    { key: 'common', title: t('learn.commonTerms') },
    ...content.systems.map((system) => ({
      key: system.key,
      title: system[locale === 'en' ? 'en' : 'zh'].title,
    })),
    { key: 'daily', title: t('nav.today') },
  ].filter((group) => content.glossary.some((entry) => entry.system === group.key));
  return (
    <>
      <nav className="report-card" aria-label={t('learn.groupNavigation')}>
        <ul className="learn-grid">
          {groups.map((group) => (
            <li key={group.key}>
              <a href={`#system-${group.key}`}>{t('report.content', { text: group.title })}</a>
            </li>
          ))}
        </ul>
      </nav>
      {groups.map((group) => (
        <section
          id={`system-${group.key}`}
          className="report-card tutorial-section"
          key={group.key}
        >
          <h2>{t('report.content', { text: group.title })}</h2>
          <ul className="learn-grid">
            {content.glossary
              .filter((entry) => entry.system === group.key)
              .map((entry) => (
                <li key={entry.key}>
                  <Link href={`/learn/glossary/${entry.key}`}>
                    {t('report.content', { text: entry[locale === 'en' ? 'en' : 'zh'].term })}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
