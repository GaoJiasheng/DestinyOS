'use client';
import { useTranslations } from 'next-intl';
import { IchingCategorySchema, QimenCategorySchema } from '@tianji/shared';
import { Button } from '@/components/ui/button';
import type { CastMethod } from './divination-flow';
/** Question, category and civil-clock inputs; retries keep the snapshot until an input changes. */
export function DivinationFields({
  system,
  method,
  step,
  busy,
  question,
  setQuestion,
  category,
  setCategory,
  local,
  setLocal,
  tz,
  setTz,
  now,
  lunar,
  resetSnapshot,
}: {
  system: 'iching' | 'qimen';
  method: CastMethod;
  step: 'question' | 'ritual' | 'generating';
  busy: boolean;
  question: string;
  setQuestion: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  local: string;
  setLocal: (value: string) => void;
  tz: string;
  setTz: (value: string) => void;
  now: () => void;
  lunar: string | null;
  resetSnapshot: () => void;
}) {
  const t = useTranslations('divination');
  const categories =
    system === 'iching' ? IchingCategorySchema.options : QimenCategorySchema.options;
  return (
    <>
      {step === 'question' ? (
        <>
          <label className="birth-field">
            {t('question')}
            <textarea
              maxLength={120}
              placeholder={t('questionPlaceholder')}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                resetSnapshot();
              }}
            />
          </label>
          <p className="muted">{t('questionOptional')}</p>
          <fieldset disabled={busy}>
            <legend>{t('category')}</legend>
            <div className="category-chips">
              {categories.map((c) => (
                <Button
                  type="button"
                  key={c}
                  variant={c === category ? 'default' : 'secondary'}
                  aria-pressed={c === category}
                  onClick={() => {
                    setCategory(c);
                    resetSnapshot();
                  }}
                >
                  {t(`categories.${c}`)}
                </Button>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      {system === 'qimen' || (step === 'ritual' && method === 'time') ? (
        <>
          <label className="birth-field">
            {t('castAt')}
            <input
              type="datetime-local"
              required
              min="1900-01-01T00:00"
              max="2100-12-31T23:59"
              disabled={busy}
              value={local}
              onChange={(e) => {
                setLocal(e.target.value);
                resetSnapshot();
              }}
            />
          </label>
          <label className="birth-field">
            {t('timezone')}
            <input
              required
              list="cast-timezones"
              disabled={busy}
              value={tz}
              onChange={(e) => {
                setTz(e.target.value);
                resetSnapshot();
              }}
            />
          </label>
          <datalist id="cast-timezones">
            {Intl.supportedValuesOf('timeZone').map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <Button type="button" variant="secondary" disabled={busy} onClick={now}>
            {t('now')}
          </Button>
          {system === 'iching' && lunar ? <p className="notice">{lunar}</p> : null}
        </>
      ) : null}
    </>
  );
}
