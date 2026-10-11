import { Suspense } from 'react';
import { NavigationProgress } from '@/components/navigation-progress';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { adminLocale, requireAdmin } from '@/lib/admin-auth';
import { getAdminCopy } from '@/i18n/admin-copy';
import { adminLanguageAction } from './actions';
import '../globals.css';
import './admin.css';
export const dynamic = 'force-dynamic';
/** Localized administrator document title satisfies screen-reader and indexing metadata requirements. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminCopy();
  return {
    title: t('admin.title'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}
/** Independent admin root shell: no AdSense or public-layout dependencies, with a bilingual navigation. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(false);
  const locale = await adminLocale();
  setRequestLocale(locale);
  const t = await getAdminCopy();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={await getMessages({ locale })}>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <a className="skip-link" href="#main">
            {t('common.skip')}
          </a>
          <header className="admin-header">
            <a href="/admin">{t('admin.title')}</a>
            <form action={adminLanguageAction}>
              <label htmlFor="admin-language">{t('me.language')}</label>
              <select id="admin-language" name="locale" defaultValue={locale}>
                <option value="zh">{t('me.language.zh')}</option>
                <option value="en">{t('me.language.en')}</option>
              </select>
              <Button type="submit" variant="secondary">
                {t('admin.apply')}
              </Button>
            </form>
          </header>
          <nav aria-label={t('admin.navigation')} className="admin-nav">
            {(
              [
                'dashboard',
                'users',
                'knowledge',
                'releases',
                'config',
                'feedback',
                'audit',
              ] as const
            ).map((key) => (
              <a
                key={key}
                href={
                  key === 'dashboard'
                    ? '/admin'
                    : key === 'releases'
                      ? '/admin/knowledge/releases'
                      : `/admin/${key}`
                }
              >
                {t(`admin.nav.${key}`)}
              </a>
            ))}
          </nav>
          <main id="main" tabIndex={-1} className="admin-main">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
