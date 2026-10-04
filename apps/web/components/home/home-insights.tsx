'use client';
import { useEffect, useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { getProfileAction } from '@/app/readings/actions';
import { getMotionPreferenceAction } from '@/app/home/actions';
import { HomeSky } from './home-sky';
import { systems } from '@/lib/system-links';
import type { DailyChart } from '@tianji/shared';
/** Resolve saved/local profiles after hydration without embedding private information in cached HTML. */
export function HomeInsights({
  initialSky,
}: {
  initialSky: { phase: string; stem: string; branch: string; term: string };
}) {
  const t = useCopy();
  const [motion, setMotion] = useState<boolean | null>(null);
  const [allowLocation, setAllowLocation] = useState(false);
  const [daily, setDaily] = useState<DailyChart | null>(null);
  const [sky, setSky] = useState<{
    phase: string;
    stem: string;
    branch: string;
    term: string;
  } | null>(initialSky);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const track = (event: MouseEvent) => {
      const system =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-home-system]')?.dataset.homeSystem
          : undefined;
      if (systems.some((value) => value === system))
        window.dispatchEvent(
          new CustomEvent('tianji:event', { detail: { name: `home.card.${system}` } }),
        );
    };
    document.addEventListener('click', track);
    return () => document.removeEventListener('click', track);
  }, []);
  useEffect(() => {
    let live = true;
    const run = async () => {
      const [local, saved, preference] = await Promise.all([
        (localStorage.getItem('tianji.anon')
          ? import('@/lib/anonymous-storage').then(({ readAnonymous }) => readAnonymous())
          : Promise.resolve(null)
        ).catch(() => null),
        getProfileAction().catch(() => null),
        getMotionPreferenceAction().catch(() => false),
      ]);
      if (!live) return;
      const reduced = preference || local?.settings.reducedMotion === true;
      setMotion(reduced);
      setAllowLocation(!!(saved?.ok && saved.data));
      document.documentElement.dataset.reducedMotion = String(reduced);
      const birth = saved?.ok && saved.data ? saved.data : local?.profile;
      if (!birth && revision === 0) return;
      if (revision === 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
        if (!live) return;
      }
      // DESIGN-GAP: Home uses a deferred engine import rather than downloading natal/daily computation in its initial JS.
      const { computeHomeInsights } = await import('@/lib/home-insights');
      const result = computeHomeInsights(
        birth,
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      if (live) {
        setDaily(result.daily);
        setSky(result.sky);
        setError(false);
      }
    };
    run().catch(() => {
      if (live) {
        setMotion(false);
        setError(true);
      }
    });
    const day = setInterval(() => {
      if (!document.hidden) setRevision((n) => n + 1);
    }, 60_000);
    return () => {
      live = false;
      clearInterval(day);
    };
  }, [revision]);
  return (
    <>
      <HomeSky reducedMotion={motion} allowLocation={allowLocation} />
      <section
        className="home-glimpse home-section"
        aria-labelledby="glimpse-title"
        aria-busy={!sky && !error}
      >
        <div>
          <p className="eyebrow">{t('home.glimpse.eyebrow')}</p>
          <h2 id="glimpse-title">{t(daily ? 'home.glimpse.title' : 'home.glimpse.sky')}</h2>
        </div>
        {error ? (
          <p role="status">
            {t('home.glimpse.error')}{' '}
            <button className="text-link" type="button" onClick={() => setRevision((n) => n + 1)}>
              {t('common.retry')}
            </button>
          </p>
        ) : !sky ? (
          <p role="status">{t('home.glimpse.loading')}</p>
        ) : daily ? (
          <>
            <p
              className="glimpse-rating"
              aria-label={t('home.glimpse.rating', {
                stars: Math.max(1, Math.min(5, Math.round(daily.scores.overall / 20))),
              })}
            >
              <span aria-hidden>
                {'★'.repeat(Math.max(1, Math.min(5, Math.round(daily.scores.overall / 20))))}
                {'☆'.repeat(5 - Math.max(1, Math.min(5, Math.round(daily.scores.overall / 20))))}
              </span>
            </p>
            <p>{t(daily.oneLiner as Parameters<typeof t>[0])}</p>
            <p className="lucky-color">
              <span style={{ backgroundColor: daily.bazi.luckyColorHex }} aria-hidden />
              {t('home.glimpse.color')} {t(daily.bazi.luckyColor[0] as Parameters<typeof t>[0])}
            </p>
          </>
        ) : (
          <dl className="sky-facts">
            <div>
              <dt>{t('home.glimpse.moon')}</dt>
              <dd>{t(`daily.moonPhase.${sky.phase}` as Parameters<typeof t>[0])}</dd>
            </div>
            <div>
              <dt>{t('home.glimpse.ganzhi')}</dt>
              <dd>
                {t(`bazi.stems.${sky.stem}` as Parameters<typeof t>[0])}
                {t(`bazi.branches.${sky.branch}` as Parameters<typeof t>[0])}
              </dd>
            </div>
            <div>
              <dt>{t('home.glimpse.term')}</dt>
              <dd>{t(`home.term.${sky.term}` as Parameters<typeof t>[0])}</dd>
            </div>
          </dl>
        )}
        <Link className="text-link" href={daily ? '/today' : '/me/birth'}>
          {t(daily ? 'home.cta.today' : 'home.glimpse.profile')} <span aria-hidden>↗</span>
        </Link>
      </section>
    </>
  );
}
