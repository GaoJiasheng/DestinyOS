import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/i18n/routing';
import { getCopy } from '@/i18n/get-copy';
import { Link } from '@/i18n/navigation';
import { cookies } from 'next/headers';
import { ConfirmLoginForm } from '@/components/auth/confirm-login-form';
import { verificationSchema } from '@/lib/auth-confirmation';
import { confirmLoginAction, confirmLoginTargetAction } from '../actions';
import { returnCookie, safeReturnPath } from '../return-path';
import { privatePageMetadata } from '@/lib/page-metadata';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  privatePageMetadata(params, 'seo.page.verify', { extra: { referrer: 'no-referrer' } });

export const dynamic = 'force-dynamic';

/** A GET only displays a confirmation form; it never reads or consumes a verification token. */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; email?: string; returnTo?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getCopy();
  const query = await searchParams;
  const parsed = verificationSchema.safeParse({ ...query, locale });
  // Keep the pending destination (same-browser cookie) when sending the person back to request a new link.
  const pendingReturn = parsed.success
    ? undefined
    : safeReturnPath((await cookies()).get(returnCookie)?.value, locale);
  const loginHref =
    pendingReturn && pendingReturn !== `/${locale}`
      ? `/auth/login?callbackUrl=${encodeURIComponent(pendingReturn)}`
      : '/auth/login';
  return (
    <section className="auth-panel">
      <h1>{t('auth.verify.confirm')}</h1>
      {parsed.success ? (
        <>
          <p>{t('auth.verify.description')}</p>
          <ConfirmLoginForm
            fallback={confirmLoginAction.bind(
              null,
              locale,
              parsed.data.token,
              parsed.data.email,
              query.returnTo,
            )}
            navigate={confirmLoginTargetAction.bind(
              null,
              locale,
              parsed.data.token,
              parsed.data.email,
              query.returnTo,
            )}
          />
        </>
      ) : (
        <>
          <p role="alert">{t('auth.error.verification')}</p>
          <Link href={loginHref}>{t('auth.login.title')}</Link>
        </>
      )}
    </section>
  );
}
