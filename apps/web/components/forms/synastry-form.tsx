'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import type { BirthInput, Locale } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { useRouter, Link } from '@/i18n/navigation';
import { createReadingAction } from '@/app/readings/actions';
import { BirthForm } from './birth-form';
import { Button } from '@/components/ui/button';
import { DivinationLoader } from '@/components/ui/divination-loader';
import { updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading, ReadingRequest } from '@/lib/reading-schema';
/** Two profile selectors never put private inputs in URLs; anonymous pairs stay in encrypted device storage. */
export function SynastryForm({
  profiles = [],
  selectedId,
  signedIn = false,
}: {
  profiles?: { id: string; label: string }[];
  selectedId?: string | null;
  signedIn?: boolean;
}) {
  const t = useCopy(),
    locale = useLocale() as Locale,
    router = useRouter();
  const [a, setA] = useState(selectedId ?? profiles[0]?.id ?? ''),
    [b, setB] = useState(profiles.find((p) => p.id !== (selectedId ?? profiles[0]?.id))?.id ?? ''),
    [birthA, setBirthA] = useState<BirthInput | null>(null),
    [birthB, setBirthB] = useState<BirthInput | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit() {
    if (signedIn ? !a || !b || a === b : !birthA || !birthB) {
      setError('E_VALIDATION');
      return;
    }
    setBusy(true);
    setError(null);
    const request: ReadingRequest = {
      system: 'synastry',
      locale,
      idempotencyKey: crypto.randomUUID(),
      ...(signedIn
        ? { profileId: a, partnerProfileId: b }
        : { birth: birthA!, partnerBirth: birthB! }),
    };
    try {
      const result = await createReadingAction(request);
      if (!result.ok) {
        setError(result.error.code);
        return;
      }
      if ('readingId' in result.data && result.data.readingId) {
        router.push(`/synastry/r/${result.data.readingId}`);
        return;
      }
      const reading: LocalReading = {
        id: crypto.randomUUID(),
        system: 'synastry',
        request,
        createdAt: new Date().toISOString(),
        title: null,
        ...result.data,
      };
      await updateAnonymous((data) => ({
        ...data,
        readings: [reading, ...data.readings].slice(0, 50),
      }));
      router.push(`/synastry/r/local/${reading.id}`);
    } catch {
      setError('E_INTERNAL');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-page">
      <h1 className="type-h1">{t('synastry.title')}</h1>
      <p>{t('synastry.intro')}</p>
      <p className="muted">{t('synastry.roles')}</p>
      {signedIn ? (
        <>
          <div className="daily-grid">
            {(['a', 'b'] as const).map((side) => (
              <label className="birth-field" key={side}>
                {t(`synastry.${side}`)}
                <select
                  aria-label={t(`synastry.${side}`)}
                  value={side === 'a' ? a : b}
                  onChange={(e) => {
                    (side === 'a' ? setA : setB)(e.target.value);
                    setError(null);
                  }}
                >
                  <option value="">{t('profiles.select')}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t('report.content', { text: p.label || t('profiles.unnamed') })}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <Link href="/me/profiles">{t('profiles.manage')}</Link>
        </>
      ) : (
        <>
          <p>
            {t('synastry.login')} <Link href="/auth/login">{t('nav.login')}</Link>
          </p>
          <h2>{t(birthA ? 'synastry.b' : 'synastry.a')}</h2>
          {!birthB ? (
            <BirthForm
              key={birthA ? 'b' : 'a'}
              profileMode
              completionKey="profiles.save"
              onComplete={(birth) => {
                if (!birthA) setBirthA(birth);
                else setBirthB(birth);
              }}
            />
          ) : null}
        </>
      )}
      <div className="hero-actions">
        <Button
          disabled={busy || !(signedIn ? a && b && a !== b : birthA && birthB)}
          onClick={() => void submit()}
        >
          {t('synastry.submit')}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setA(b);
            setB(a);
            setBirthA(birthB);
            setBirthB(birthA);
          }}
        >
          {t('synastry.swap')}
        </Button>
      </div>
      {error ? (
        <p role="alert">
          {error === 'E_VALIDATION'
            ? t('synastry.requiresTwo')
            : t(`report.error.${error}` as Parameters<typeof t>[0])}
        </p>
      ) : null}
      {busy ? <DivinationLoader /> : null}
    </section>
  );
}
