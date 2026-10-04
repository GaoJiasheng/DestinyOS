import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/routing';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { ConfirmButton } from '@/components/forms/confirm-button';
import { verificationSchema } from '@/lib/auth-confirmation';
import { confirmLoginAction } from '../actions';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

/** A GET only displays a confirmation form; it never reads or consumes a verification token. */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getCopy();
  const parsed = verificationSchema.safeParse({ ...(await searchParams), locale });
  return (
    <section className="auth-panel">
      <h1>{t('auth.verify.confirm')}</h1>
      {parsed.success ? (
        <>
          <p>{t('auth.verify.description')}</p>
          <form
            action={confirmLoginAction.bind(null, locale, parsed.data.token, parsed.data.email)}
          >
            <ConfirmButton />
          </form>
        </>
      ) : (
        <>
          <p role="alert">{t('auth.error.verification')}</p>
          <Link href="/auth/login">{t('auth.login.title')}</Link>
        </>
      )}
    </section>
  );
}
