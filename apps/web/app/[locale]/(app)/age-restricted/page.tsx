import { getCopy } from '@/i18n/get-copy';
/** Neutral age restriction page contains no birth data or advertising. */
export default async function AgeRestricted() {
  const t = await getCopy();
  return (
    <section className="status-page">
      <h1 className="type-h2">{t('form.birth.age.title')}</h1>
      <p className="muted">{t('form.birth.age.body')}</p>
    </section>
  );
}
