'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import type { BirthInput, Locale } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { useRouter, Link } from '@/i18n/navigation';
import { LoginLink } from '@/components/auth/login-link';
import { createReadingAction } from '@/app/readings/actions';
import dynamic from 'next/dynamic';
import { ChunkLoading } from '@/components/ui/chunk-loading';
import { ensureConsent } from '@/lib/consent';
import { Button } from '@/components/ui/button';
import { DivinationLoader } from '@/components/ui/divination-loader';
import { updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading, ReadingRequest } from '@/lib/reading-schema';
import type { BirthTarget } from './birth-form-parts';
import { clearDraft, readDraft, writeDraft } from '@/lib/birth-form-draft';
// DESIGN-GAP: Signed-in pairing starts from saved profiles; the birth editor loads only when someone is entered by hand.
const BirthForm = dynamic(() => import('./birth-form').then((module) => module.BirthForm), {
  loading: ChunkLoading,
});
/** Select value for "enter this person by hand"; it is never a profile ID. */
const TEMP = '__temp';
/** Two profile selectors never put private inputs in URLs; anonymous pairs stay in encrypted device storage.
 * Signed in, side B may be entered by hand for this report only, matching the anonymous flow. */
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
  const first = selectedId ?? profiles[0]?.id;
  // Guests always enter both people; an owner with no saved profile enters A as well.
  const [a, setA] = useState(signedIn && first ? first : TEMP),
    [b, setB] = useState((signedIn && profiles.find((p) => p.id !== first)?.id) || TEMP),
    [birthA, setBirthA] = useState<BirthInput | null>(null),
    [birthB, setBirthB] = useState<BirthInput | null>(null),
    // Whose birth each hand-entered side is; B is always someone else, A is asked when under 13.
    [subjects, setSubjects] = useState<Record<'a' | 'b', BirthTarget>>({ a: 'self', b: 'other' }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [editing, setEditing] = useState<'a' | 'b' | null>(null),
    [restored, setRestored] = useState(false);
  // Completed guest entries survive a reload in this tab; in-progress fields use each form's own draft.
  useEffect(() => {
    if (signedIn) return;
    const draft = readDraft<{
      a: BirthInput | null;
      b: BirthInput | null;
      subjects?: Record<'a' | 'b', BirthTarget>;
    }>('synastry', 'v1');
    if (draft) {
      setBirthA(draft.a);
      setBirthB(draft.b);
      // Drafts saved before the mark existed describe the user on side A.
      if (draft.subjects?.a === 'other') setSubjects({ a: 'other', b: 'other' });
    }
    setRestored(true);
  }, [signedIn]);
  useEffect(() => {
    if (restored && (birthA || birthB))
      writeDraft('synastry', 'v1', { a: birthA, b: birthB, subjects });
  }, [restored, birthA, birthB, subjects]);
  const entered = { a: a === TEMP, b: b === TEMP };
  const active = editing ?? (entered.a && !birthA ? 'a' : entered.b && !birthB ? 'b' : null);
  const ready =
    (entered.a ? Boolean(birthA) : Boolean(a)) &&
    (entered.b ? Boolean(birthB) : Boolean(b)) &&
    (entered.a || entered.b || a !== b);
  // Side A must stay a saved profile when the owner has one, so a hand-entered B cannot move to A.
  const canSwap = !(signedIn && profiles.length > 0 && entered.b);
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
    if (!ready) {
      setError('E_VALIDATION');
      return;
    }
    setBusy(true);
    setError(null);
    const request: ReadingRequest = {
      system: 'synastry',
      locale,
      idempotencyKey: crypto.randomUUID(),
      ...(entered.a ? { birth: birthA!, subject: subjects.a } : { profileId: a }),
      ...(entered.b ? { partnerBirth: birthB! } : { partnerProfileId: b }),
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
      {signedIn && profiles.length ? (
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
                    setEditing(null);
                    setError(null);
                  }}
                >
                  <option value="">{t('profiles.select')}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t('report.content', { text: p.label || t('profiles.unnamed') })}
                    </option>
                  ))}
                  {side === 'b' ? <option value={TEMP}>{t('synastry.tempOption')}</option> : null}
                </select>
              </label>
            ))}
          </div>
          <Link href="/me/profiles">{t('profiles.manage')}</Link>
        </>
      ) : !signedIn ? (
        <p>
          {t('synastry.login')} <LoginLink>{t('nav.login')}</LoginLink>
        </p>
      ) : null}
      {signedIn && (entered.a || entered.b) ? (
        <p className="muted">{t('synastry.tempHint')}</p>
      ) : null}
      {(['a', 'b'] as const).map((side) => {
        const value = side === 'a' ? birthA : birthB;
        return entered[side] && value && active !== side ? (
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
      {active && (restored || signedIn) ? (
        <>
          <h2>{t(`synastry.${active}`)}</h2>
          <BirthForm
            key={active}
            profileMode
            signedIn={signedIn}
            completionKey={signedIn ? 'synastry.useTemp' : 'profiles.save'}
            draftKey={`synastry-${active}`}
            // The partner form never starts from the device profile.
            prefillProfile={!signedIn && active === 'a'}
            initial={(active === 'a' ? birthA : birthB) ?? undefined}
            subject={active === 'b' ? 'other' : undefined}
            onComplete={(birth, _name, who) => {
              (active === 'a' ? setBirthA : setBirthB)(birth);
              setSubjects((current) => ({ ...current, [active]: who }));
              setEditing(null);
            }}
          />
        </>
      ) : null}
      <div className="hero-actions">
        <Button
          disabled={busy || !ready}
          action={async () => {
            if (await ensureConsent()) await submit();
          }}
        >
          {t('synastry.submit')}
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !canSwap}
          onClick={() => {
            setA(b);
            setB(a);
            setBirthA(birthB);
            setBirthB(birthA);
            setSubjects((current) => ({ a: current.b, b: current.a }));
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
