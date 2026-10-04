'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { dailyTarotSeed, drawDaily } from '@tianji/engine/tarot';
import type { TarotChart } from '@tianji/shared';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import { Button } from '@/components/ui/button';
import { TarotCard } from './tarot-card';
/** Fixed local-day card for a signed-in identity or the encrypted device anonId; refreshes after midnight. */
export function DailyTarotCard({ userId }: { userId?: string }) {
  const t = useTranslations('tarot');
  const [card, setCard] = useState<TarotChart['cards'][number] | null>(null);
  const [date, setDate] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const data = userId ? null : ((await readAnonymous()) ?? (await updateAnonymous((d) => d)));
        const identity = userId ?? data!.anonId;
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const drawn = drawDaily(dailyTarotSeed(identity, localDate));
        if (active) {
          setCard(drawn);
          setDate(localDate);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void update();
    const refresh = () => {
      void update();
    };
    // DESIGN-GAP: Check the browser's local calendar once a minute and on focus, without requiring a birth profile.
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [userId, retry]);
  return (
    <section className="report-card daily-tarot" data-theme="west">
      <h2 className="type-h2">{t('daily')}</h2>
      <p>{t('dailyHelp')}</p>
      {error ? (
        <div role="alert">
          {t('dailyMissing')}
          <Button onClick={() => setRetry((n) => n + 1)}>{t('retry')}</Button>
        </div>
      ) : card ? (
        <>
          <time dateTime={date}>{date}</time>
          <div className="tarot-daily-content">
            <TarotCard card={card} revealed position={t('daily')} />
            <div>
              <h3>{t(`card.${card.cardKey}.name`)}</h3>
              <p>{t(card.reversed ? 'reversed' : 'upright')}</p>
              <p>
                {t(
                  `card.${card.cardKey}.${card.reversed ? 'keywordsReversed' : 'keywordsUpright'}`,
                )}
              </p>
              <p>{t(`card.${card.cardKey}.advice`)}</p>
            </div>
          </div>
        </>
      ) : (
        <p role="status">{t('saving')}</p>
      )}
    </section>
  );
}
