'use client';
import { StateArt } from '@/components/art/state-art';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { readAnonymous } from '@/lib/anonymous-storage';
import type { BirthInput } from '@tianji/shared';
/** Compute non-sensitive profile summary locally and omit unavailable moon/ascendant data. */
export function ProfileSummary({ profile }: { profile?: BirthInput }) {
  const t = useCopy(),
    intl = useTranslations(),
    [summary, setSummary] = useState<Record<string, string> | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      const input = profile ?? (await readAnonymous())?.profile;
      if (!input) return;
      const engine = await import('@tianji/engine');
      const { calendar, year, month, day, isLeapMonth, hour, minute, timeUnknown, place, gender } =
        input;
      const birth = engine.normalizeBirth({
          calendar,
          year,
          month,
          day,
          isLeapMonth,
          hour,
          minute,
          timeUnknown,
          place,
          gender,
        }),
        bazi = engine.computeBazi(birth, { now: new Date().toISOString() }),
        astro = engine.computeAstrology(birth),
        vedic = engine.computeVedic(birth, new Date().toISOString());
      const result: Record<string, string> = {
        zodiac: `daily.zodiac.${bazi.pillars.year.branch}`,
        dayMaster: `bazi.stems.${bazi.dayMaster.stem}`,
        sun: `charts.sign.${astro.bodies.find((p) => p.key === 'sun')!.sign}`,
      };
      if (!birth.timeUnknown) {
        result.moon = `charts.sign.${astro.bodies.find((p) => p.key === 'moon')!.sign}`;
        if (astro.angles)
          result.asc = `charts.sign.${['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'][Math.floor(astro.angles.asc / 30)]}`;
        result.nakshatra = `charts.nakshatra.${vedic.bodies.find((p) => p.key === 'chandra')!.nakshatra}`;
      }
      if (active) setSummary(result);
    })().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, [profile]);
  return (
    <section className="report-card">
      <h2>{t('me.profile')}</h2>
      {summary ? (
        <dl className="daily-grid">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k}>
              <dt>{intl(`me.summary.${k}`)}</dt>
              <dd>{intl(v)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <StateArt state="no-profile" />
          <p>{t('me.noProfile')}</p>
        </>
      )}
      {error ? <p role="alert">{t('report.error.E_INTERNAL')}</p> : null}
      <Link href="/me/profiles">{t('profiles.manage')}</Link>
    </section>
  );
}

/** Show an anonymous owner's display name without sending the encrypted device profile to the server. */
export function LocalDisplayName() {
  const t = useCopy(),
    [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void readAnonymous()
      .then((data) => {
        if (active) setName(data?.displayName ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return <h2>{name ? t('report.content', { text: name }) : t('me.guest')}</h2>;
}
