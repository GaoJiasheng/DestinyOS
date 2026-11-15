import { StateArt } from '@/components/art/state-art';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/routing';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { LoginForm } from '@/components/forms/login-form';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { googleLoginAction, logoutAction } from '../actions';
import { safeReturnPath } from '../return-path';
import { privatePageMetadata } from '@/lib/page-metadata';

export const dynamic = 'force-dynamic';
export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  privatePageMetadata(params, 'seo.page.login', { index: true });

/** Google and passwordless email authentication, including signed-in and retry states. */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; sent?: string; callbackUrl?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getCopy();
  const query = await searchParams;
  const session = await auth();
  // Validated once here; the actions validate again because form arguments are client-controlled.
  const returnTo = safeReturnPath(query.callbackUrl, locale);
  const callbackUrl = returnTo === `/${locale}` ? undefined : returnTo;
  return (
    <section className="auth-panel">
      <StateArt state="login" priority />
      <h1>{t('auth.login.title')}</h1>
      {session?.user ? (
        <>
          <p role="status">{t('auth.login.signedIn')}</p>
          {callbackUrl ? (
            <a href={callbackUrl}>{t('auth.login.continue')}</a>
          ) : (
            <Link href="/">{t('auth.login.continue')}</Link>
          )}
          <form action={logoutAction.bind(null, locale)}>
            <Button>{t('auth.login.signOut')}</Button>
          </form>
        </>
      ) : (
        <>
          <p>{t('auth.login.noPassword')}</p>
          {query.error && <p role="alert">{t('auth.error.verification')}</p>}
          {query.sent && <p role="status">{t('auth.login.checkInbox')}</p>}
          <form action={googleLoginAction.bind(null, locale, callbackUrl)}>
            <Button type="submit">{t('auth.login.google')}</Button>
          </form>
          <LoginForm locale={locale} />
          <p>
            <Link href="/privacy">{t('legal.privacy')}</Link> ·{' '}
            <Link href="/terms">{t('legal.terms')}</Link>
          </p>
        </>
      )}
    </section>
  );
}
