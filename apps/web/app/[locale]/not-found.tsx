import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
/** Localized missing-page state with a route back to the home page. */
export default async function NotFound() {
  const t = await getCopy();
  return (
    <section className="status-page">
      <h1 className="type-h1">{t('errors.notFound.title')}</h1>
      <p className="muted">{t('errors.notFound.body')}</p>
      <Button asChild>
        <Link href="/">{t('common.backHome')}</Link>
      </Button>
    </section>
  );
}
