'use client';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { useState, type MouseEvent } from 'react';
import { useLocale } from 'next-intl';
import { Compass, Sparkles } from 'lucide-react';
import type { Locale } from '@tianji/shared';
import { Link, useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { systems } from '@/lib/system-links';
import type { LaunchProfile, LaunchSystem } from '@/lib/launch-system';

const formSystems = ['bazi', 'ziwei', 'astrology', 'vedic', 'numerology'];
const isLaunchSystem = (system: string): system is LaunchSystem =>
  system === 'bazi' || system === 'ziwei' || system === 'astrology' || system === 'vedic';
const modified = (event: MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/** Open the system picker from the hero CTA or the mobile tab; saved profiles ask whose chart to cast. */
export function ReadingLauncher({ tab = false }: { tab?: boolean }) {
  const [open, setOpen] = useState(false);
  const t = useCopy();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { pending, run } = useSubmitTransition();
  const [working, setBusy] = useState(false);
  const busy = working || pending;
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<{ system: LaunchSystem; profile: LaunchProfile } | null>(
    null,
  );
  const show = () => {
    setChoice(null);
    setError(null);
    setOpen(true);
    window.dispatchEvent(new CustomEvent('tianji:event', { detail: { name: 'home.cta.start' } }));
  };
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const task = (work: () => Promise<void>) =>
    run(async () => {
      setBusy(true);
      setError(null);
      try {
        await work();
      } catch {
        setError('E_INTERNAL');
      } finally {
        setBusy(false);
      }
    });
  const pick = (system: LaunchSystem) =>
    task(async () => {
      const { findLaunchProfile } = await import('@/lib/launch-system');
      const profile = await findLaunchProfile();
      if (profile) setChoice({ system, profile });
      else go(`/${system}/new`);
    });
  const castMine = () =>
    task(async () => {
      if (!choice) return;
      const { launchSystem } = await import('@/lib/launch-system');
      const result = await launchSystem(choice.system, locale, choice.profile);
      if ('declined' in result) return;
      if ('error' in result) setError(result.error);
      else go(result.href);
    });
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
        title={choice ? t('home.launch.choiceTitle') : t('home.systems.title')}
        description={
          choice
            ? t('home.launch.choiceNote', { system: t(`nav.${choice.system}`) })
            : t('home.systems.note')
        }
      >
        {busy ? <p role="status">{t('report.loading')}</p> : null}
        {error ? <p role="alert">{t(`report.error.${error}` as Parameters<typeof t>[0])}</p> : null}
        {choice ? (
          <div className="dialog-actions launch-choice" aria-busy={busy}>
            <Button type="button" disabled={busy} onClick={castMine}>
              {t('home.launch.useMine')}
            </Button>
            <Button variant="secondary" asChild>
              <Link
                prefetch={true}
                href={`/${choice.system}/new`}
                aria-disabled={busy}
                onClick={(event) => {
                  if (busy) event.preventDefault();
                  else if (!modified(event)) setOpen(false);
                }}
              >
                {t('home.launch.someoneElse')}
              </Link>
            </Button>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setChoice(null);
                setError(null);
              }}
            >
              {t('home.launch.back')}
            </button>
          </div>
        ) : (
          <div className="system-picker" aria-busy={busy}>
            {systems.map((system, index) => (
              <Link
                prefetch={true}
                key={system}
                href={formSystems.includes(system) ? `/${system}/new` : `/${system}`}
                aria-disabled={busy}
                onClick={(event) => {
                  if (modified(event)) return;
                  window.dispatchEvent(
                    new CustomEvent('tianji:event', { detail: { name: `home.card.${system}` } }),
                  );
                  if (busy) {
                    event.preventDefault();
                    return;
                  }
                  if (!isLaunchSystem(system)) {
                    setOpen(false);
                    return;
                  }
                  event.preventDefault();
                  pick(system);
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
                      formSystems.includes(system)
                        ? 'home.cards.birth'
                        : system === 'synastry'
                          ? 'synastry.requiresTwo'
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
        )}
      </Dialog>
    </>
  );
}
