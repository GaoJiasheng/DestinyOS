'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import type { BirthInput, Locale } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { useRouter, Link } from '@/i18n/navigation';
import { createReadingAction } from '@/app/readings/actions';
import dynamic from 'next/dynamic';
import { ensureConsent } from '@/lib/consent';
import { Button } from '@/components/ui/button';
import { DivinationLoader } from '@/components/ui/divination-loader';
import { updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading, ReadingRequest } from '@/lib/reading-schema';
import { clearDraft, readDraft, writeDraft } from '@/lib/birth-form-draft';
// DESIGN-GAP: Signed-in pairing uses saved profiles; load the birth editor only for the anonymous input flow.
const BirthForm = dynamic(() => import('./birth-form').then((module) => module.BirthForm));
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
    [error, setError] = useState<string | null>(null),
    [editing, setEditing] = useState<'a' | 'b' | null>(null),
    [restored, setRestored] = useState(false);
  // Completed guest entries survive a reload in this tab; in-progress fields use each form's own draft.
  useEffect(() => {
    if (signedIn) return;
    const draft = readDraft<{ a: BirthInput | null; b: BirthInput | null }>('synastry', 'v1');
    if (draft) {
      setBirthA(draft.a);
      setBirthB(draft.b);
    }
    setRestored(true);
  }, [signedIn]);
  useEffect(() => {
    if (restored && (birthA || birthB)) writeDraft('synastry', 'v1', { a: birthA, b: birthB });
  }, [restored, birthA, birthB]);
  const active = editing ?? (!birthA ? 'a' : !birthB ? 'b' : null);
  const pad = (n: number | undefined) => String(n ?? 0).padStart(2, '0');
  const summary = (birth: BirthInput) =>
    [
      t(`form.birth.calendar.${birth.calendar}`),
      `${birth.isLeapMonth ? t('form.birth.lunar.leap', { month: birth.month }) + ' ' : ''}${birth.year}-${pad(birth.month)}-${pad(birth.day)}`,
      birth.timeUnknown || birth.hour === undefined
        ? t('synastry.noTime')
        : `${pad(birth.hour)}:${pad(birth.minute)}`,
      birth.place?.name,
    ]
      .filter(Boolean)
      .join(' · ');
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
      for (const key of ['synastry', 'synastry-a', 'synastry-b']) clearDraft(key);
      router.push(`/synastry/r/local/${reading.id}`);
    } catch {
      setError('E_INTERNAL');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-page">
      <h2 className="type-h1">{t('synastry.title')}</h2>
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
          {(['a', 'b'] as const).map((side) => {
            const value = side === 'a' ? birthA : birthB;
            return value && active !== side ? (
              <div className="notice synastry-summary" key={side}>
                <p>
                  <strong>{t(`synastry.${side}`)}</strong> {summary(value)}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditing(side)}
                >
                  {t('synastry.edit')}
                </Button>
              </div>
            ) : null;
          })}
          {active && restored ? (
            <>
              <h2>{t(`synastry.${active}`)}</h2>
              <BirthForm
                key={active}
                profileMode
                completionKey="profiles.save"
                draftKey={`synastry-${active}`}
                // The partner form never starts from the device profile.
                prefillProfile={active === 'a'}
                initial={(active === 'a' ? birthA : birthB) ?? undefined}
                onComplete={(birth) => {
                  (active === 'a' ? setBirthA : setBirthB)(birth);
                  setEditing(null);
                }}
              />
            </>
          ) : null}
        </>
      )}
      <div className="hero-actions">
        <Button
          disabled={busy || !(signedIn ? a && b && a !== b : birthA && birthB)}
          action={async () => {
            if (await ensureConsent()) await submit();
          }}
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
