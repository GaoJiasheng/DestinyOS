'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Sun, Compass, Sparkles, BookOpen, UserRound } from 'lucide-react';
import { brand } from '@tianji/shared/brand';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { LocaleSwitch } from './locale-switch';
import { ThemeSwitch } from './theme-provider';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { systems } from '@/lib/system-links';
export { systems } from '@/lib/system-links';
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
  const locale = useLocale() === 'en' ? 'en' : 'zh';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const show = () => {
    setOpen(true);
    window.dispatchEvent(new CustomEvent('tianji:event', { detail: { name: 'home.cta.start' } }));
  };
  return (
    <>
      {tab ? (
        <button type="button" onClick={show}>
          <Compass size={21} aria-hidden />
          <span>{t('nav.reading')}</span>
        </button>
      ) : (
        <Button onClick={show}>
          {t('home.cta.start')}
          <Sparkles size={17} aria-hidden />
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={t('home.systems.title')}
        description={t('home.systems.note')}
      >
        {busy ? <p role="status">{t('report.loading')}</p> : null}
        {error ? <p role="alert">{t(`report.error.${error}` as Parameters<typeof t>[0])}</p> : null}
        <div className="system-picker" aria-busy={busy}>
          {systems.map((system, index) => (
            <Link
              key={system}
              href={
                ['bazi', 'ziwei', 'astrology', 'vedic'].includes(system)
                  ? `/${system}/new`
                  : `/${system}`
              }
              aria-disabled={busy}
              onClick={async (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                window.dispatchEvent(
                  new CustomEvent('tianji:event', { detail: { name: `home.card.${system}` } }),
                );
                if (busy) {
                  event.preventDefault();
                  return;
                }
                if (
                  system !== 'bazi' &&
                  system !== 'ziwei' &&
                  system !== 'astrology' &&
                  system !== 'vedic'
                ) {
                  setOpen(false);
                  return;
                }
                event.preventDefault();
                setBusy(true);
                setError(null);
                try {
                  const { launchSystem } = await import('@/lib/launch-system');
                  const result = await launchSystem(system, locale);
                  if ('error' in result) setError(result.error);
                  else {
                    setOpen(false);
                    router.push(result.href);
                  }
                } catch {
                  setError('E_INTERNAL');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <span className="system-index" aria-hidden>
                {t('common.number', { value: index + 1 })}
              </span>
              <span>
                <strong>{t(`nav.${system}`)}</strong>
                <span className="muted type-small">{t(`${system}.placeholder`)}</span>
                <span className="muted type-caption">
                  {t(
                    ['bazi', 'ziwei', 'astrology', 'vedic'].includes(system)
                      ? 'home.cards.birth'
                      : system === 'qimen'
                        ? 'home.cards.location'
                        : 'home.cards.noBirth',
                  )}{' '}
                  · {t('home.cards.duration')}
                </span>
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
