'use client';
import { SystemArt } from '@/components/art/system-art';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CategorySchema,
  SpreadKeySchema,
  TAROT_SPREADS,
  type Category,
  type SpreadKey,
} from '@tianji/shared';
import { useRouter } from '@/i18n/navigation';
import { updateAnonymous } from '@/lib/anonymous-storage';
import { Button } from '@/components/ui/button';
import { SpreadThumbnail } from './spread-layout';
// DESIGN-GAP: Undocumented ritual control keys use tarot.*; canonical card/position names come from the bilingual content tables.
/** Choose a documented spread and store the private question inside the existing encrypted device envelope. */
export function TarotSelection() {
  const t = useTranslations('tarot');
  const router = useRouter();
  const [spread, setSpread] = useState<SpreadKey>('three_ppf');
  const [category, setCategory] = useState<Category>('general');
  const [question, setQuestion] = useState('');
  const [allowReversed, setReversed] = useState(true);
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <section className="tarot-page">
      <SystemArt system="tarot" banner priority />
      <header>
        <p className="eyebrow">{t('intro')}</p>
        <h1 className="type-h1">{t('title')}</h1>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(false);
          void updateAnonymous((data) => ({
            ...data,
            settings: {
              ...data.settings,
              tarotDraft: {
                spread,
                category,
                question,
                allowReversed,
                seed: seed.trim() || crypto.randomUUID(),
              },
            },
          }))
            .then(() => router.push('/tarot/reading'))
            .catch(() => {
              setBusy(false);
              setError(true);
            });
        }}
      >
        <div className="tarot-spread-options">
          {SpreadKeySchema.options.map((key) => (
            <label className={`tarot-spread-option ${spread === key ? 'selected' : ''}`} key={key}>
              <input
                type="radio"
                name="spread"
                value={key}
                checked={spread === key}
                onChange={() => setSpread(key)}
              />
              <SpreadThumbnail spread={key} />
              <strong>{t(`spread.${key}.name`)}</strong>
              <span>{t(`spread.${key}.hint`)}</span>
              <span>
                {t('pickCount', {
                  count: TAROT_SPREADS[key].length,
                  total: TAROT_SPREADS[key].length,
                })}
              </span>
            </label>
          ))}
        </div>
        <label className="tarot-field">
          {t('question')}
          <textarea
            name="question"
            maxLength={120}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <label className="tarot-field">
          {t('category.__value')}
          <select
            value={category}
            onChange={(e) => setCategory(CategorySchema.parse(e.target.value))}
          >
            {CategorySchema.options.map((key) => (
              <option key={key} value={key}>
                {t(`category.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="tarot-toggle">
          <input
            type="checkbox"
            checked={allowReversed}
            onChange={(e) => setReversed(e.target.checked)}
          />
          {t('allowReversed')}
        </label>
        <details>
          <summary>{t('seed')}</summary>
          <label className="tarot-field">
            {t('seedHelp')}
            <input
              name="seed"
              value={seed}
              maxLength={200}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
        </details>
        {error ? <p role="alert">{t('error')}</p> : null}
        <Button type="submit" disabled={busy}>
          {t('begin')}
        </Button>
      </form>
    </section>
  );
}
