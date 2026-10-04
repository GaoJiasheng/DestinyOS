'use client';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { TarotDeck } from './tarot-deck';
/** Keyboard, click and horizontal touch gestures all shuffle the same deterministic ritual. */
export function TarotShuffle({ count, onShuffle }: { count: number; onShuffle: () => void }) {
  const t = useTranslations('tarot');
  const down = useRef(0);
  const swiped = useRef(false);
  return (
    <div>
      <p>{t('shuffleHelp')}</p>
      <button
        className="tarot-shuffle"
        type="button"
        aria-label={t('shuffle')}
        onPointerDown={(e) => {
          down.current = e.clientX;
          swiped.current = false;
        }}
        onPointerUp={(e) => {
          if (Math.abs(e.clientX - down.current) > 25) {
            swiped.current = true;
            onShuffle();
          }
        }}
        onClick={() => {
          if (!swiped.current) onShuffle();
          swiped.current = false;
        }}
      >
        <TarotDeck shuffles={count} />
      </button>
      <p role="status">{t('shuffleCount', { count })}</p>
    </div>
  );
}
