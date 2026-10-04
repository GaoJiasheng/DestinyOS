'use client';
import { useState } from 'react';
import { Sun, Compass, Sparkles, BookOpen, UserRound } from 'lucide-react';
import { brand } from '@tianji/shared/brand';
import { Link, usePathname } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { LocaleSwitch } from './locale-switch';
import { ThemeSwitch } from './theme-provider';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
export const systems = ['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic'] as const;
/** Responsive desktop navigation and the five-item mobile tab bar. */
export function Navigation() {
  const t = useCopy();
  const pathname = usePathname();
  return (
    <>
      <header className="site-header">
        <Link
          href="/"
          className="brand-mark"
          aria-label={t('brand.nameEn', { name: brand.nameEn })}
        >
          <span className="brand-zh">{t('brand.nameZh', { name: brand.nameZh })}</span>
          <span className="brand-en">{t('brand.nameEn', { name: brand.nameEn })}</span>
        </Link>
        <nav className="desktop-nav" aria-label={t('nav.label')}>
          {(['today', ...systems] as const).map((item) => (
            <Link
              key={item}
              href={`/${item}`}
              aria-current={pathname.startsWith(`/${item}`) ? 'page' : undefined}
            >
              {t(`nav.${item}`)}
            </Link>
          ))}
        </nav>
        <div className="header-tools">
          <LocaleSwitch />
          <ThemeSwitch />
          <Link href="/auth/login" className="login-link">
            {t('nav.login')}
          </Link>
        </div>
      </header>
      <nav className="mobile-tabs" aria-label={t('nav.label')}>
        <Link href="/today" aria-current={pathname.startsWith('/today') ? 'page' : undefined}>
          <Sun size={21} aria-hidden />
          <span>{t('nav.today')}</span>
        </Link>
        <ReadingLauncher tab />
        <AskLauncher />
        <Link href="/learn" aria-current={pathname.startsWith('/learn') ? 'page' : undefined}>
          <BookOpen size={21} aria-hidden />
          <span>{t('nav.learn')}</span>
        </Link>
        <Link href="/me" aria-current={pathname.startsWith('/me') ? 'page' : undefined}>
          <UserRound size={21} aria-hidden />
          <span>{t('nav.me')}</span>
        </Link>
      </nav>
    </>
  );
}
/** Open the seven-system picker from the hero CTA or the mobile tab. */
export function ReadingLauncher({ tab = false }: { tab?: boolean }) {
  const [open, setOpen] = useState(false);
  const t = useCopy();
  return (
    <>
      {tab ? (
        <button type="button" onClick={() => setOpen(true)}>
          <Compass size={21} aria-hidden />
          <span>{t('nav.reading')}</span>
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          {t('home.cta.start')}
          <Sparkles size={17} aria-hidden />
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('home.systems.title')}
        description={t('home.systems.note')}
      >
        <div className="system-picker">
          {systems.map((system, index) => (
            <Link key={system} href={`/${system}`} onClick={() => setOpen(false)}>
              <span className="system-index" aria-hidden>
                {t('common.number', { value: index + 1 })}
              </span>
              <span>
                <strong>{t(`nav.${system}`)}</strong>
                <span className="muted type-small">{t(`${system}.placeholder`)}</span>
              </span>
              <span aria-hidden>↗</span>
            </Link>
          ))}
        </div>
      </Dialog>
    </>
  );
}
/** Quick divination offers the documented one-card tarot and random Mei Hua choices. */
function AskLauncher() {
  const [open, setOpen] = useState(false);
  const t = useCopy();
  return (
    <>
      <button
        type="button"
        className="ask-tab"
        onClick={() => setOpen(true)}
        aria-label={t('nav.ask')}
      >
        <span>{t('nav.ask')}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={t('home.ask.title')}>
        <div className="dialog-actions">
          <Button asChild>
            <Link href="/tarot" onClick={() => setOpen(false)}>
              {t('home.ask.tarot')}
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/iching/cast?method=random" onClick={() => setOpen(false)}>
              {t('home.ask.iching')}
            </Link>
          </Button>
        </div>
      </Dialog>
    </>
  );
}
