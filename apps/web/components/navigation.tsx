'use client';
import { Sun, BookOpen, UserRound } from 'lucide-react';
import { brand } from '@tianji/shared/brand';
import { Link, usePathname } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { LocaleSwitch } from './locale-switch';
import { ThemeSwitch } from './theme-provider';
import { systems } from '@/lib/system-links';
import { ProfileSwitcher } from './me/profile-switcher';
import { useSignedIn } from './providers';
import { ReadingLauncher } from './home/reading-launcher';
import { AskLauncher } from './home/ask-launcher';
export { systems } from '@/lib/system-links';
export { ReadingLauncher } from './home/reading-launcher';
/** Return here after signing in, except from the auth screens themselves. */
function loginHref(pathname: string) {
  return pathname.startsWith('/auth')
    ? '/auth/login'
    : `/auth/login?${new URLSearchParams({ callbackUrl: pathname })}`;
}
/** Responsive desktop navigation and the five-item mobile tab bar. */
export function Navigation() {
  const t = useCopy();
  const pathname = usePathname();
  const signedIn = useSignedIn();
  return (
    <>
      <header className="site-header">
        <Link
          prefetch={true}
          href="/"
          className="brand-mark"
          aria-label={t('brand.nameEn', { name: brand.nameEn })}
        >
          <span className="brand-zh">{t('brand.nameZh', { name: brand.nameZh })}</span>
          <span className="brand-en">{t('brand.nameEn', { name: brand.nameEn })}</span>
        </Link>
        <nav className="desktop-nav" aria-label={t('nav.label')}>
          {(['today', ...systems, 'learn'] as const).map((item) => (
            <Link
              prefetch={true}
              key={item}
              href={`/${item}`}
              aria-current={pathname.startsWith(`/${item}`) ? 'page' : undefined}
            >
              {t(`nav.${item}`)}
            </Link>
          ))}
        </nav>
        <div className="header-tools">
          {/* Phones keep these in the footer and settings so the header stays one row. */}
          <div className="header-prefs">
            <LocaleSwitch />
            <ThemeSwitch />
          </div>
          {signedIn ? (
            <ProfileSwitcher />
          ) : (
            <Link prefetch={true} href={loginHref(pathname)} className="login-link">
              {t('nav.login')}
            </Link>
          )}
          <Link
            prefetch={true}
            href="/me"
            className="me-link"
            aria-current={pathname.startsWith('/me') ? 'page' : undefined}
          >
            {t('nav.me')}
          </Link>
        </div>
      </header>
      <nav className="mobile-tabs" aria-label={t('nav.label')}>
        <Link
          prefetch={true}
          href="/today"
          aria-current={pathname.startsWith('/today') ? 'page' : undefined}
        >
          <Sun size={21} aria-hidden />
          <span>{t('nav.today')}</span>
        </Link>
        <ReadingLauncher tab />
        <AskLauncher />
        <Link
          prefetch={true}
          href="/learn"
          aria-current={pathname.startsWith('/learn') ? 'page' : undefined}
        >
          <BookOpen size={21} aria-hidden />
          <span>{t('nav.learn')}</span>
        </Link>
        <Link
          prefetch={true}
          href="/me"
          aria-current={pathname.startsWith('/me') ? 'page' : undefined}
        >
          <UserRound size={21} aria-hidden />
          <span>{t('nav.me')}</span>
        </Link>
      </nav>
    </>
  );
}
