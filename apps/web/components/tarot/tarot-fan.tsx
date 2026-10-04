'use client';
import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
/** Virtual 140-degree arc: at most 25 indices are mounted, with touch, wheel and keyboard paging. */
export function TarotFan({
  deck,
  picked,
  onPick,
}: {
  deck: number[];
  picked: number[];
  onPick: (index: number) => void;
}) {
  const t = useTranslations('tarot');
  const [start, setStart] = useState(0);
  const down = useRef(0);
  const swiped = useRef(false);
  // DESIGN-GAP: Half-window padding lets the first and last cards reach the touch-friendly centre even on narrow screens.
  const move = (offset: number) =>
    setStart((current) => Math.max(-12, Math.min(65, current + offset)));
  return (
    <div>
      <p>{t('pickHelp')}</p>
      <div
        className="tarot-fan"
        onWheel={(e) => move(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1)}
        onPointerDown={(e) => {
          down.current = e.clientX;
          swiped.current = false;
        }}
        onPointerUp={(e) => {
          const distance = e.clientX - down.current;
          if (Math.abs(distance) > 25) {
            swiped.current = true;
            move(distance < 0 ? 8 : -8);
          }
        }}
      >
        {Array.from({ length: 25 }, (_, i) => ({ index: deck[start + i], slot: i }))
          .filter((item): item is { index: number; slot: number } => item.index !== undefined)
          .map(({ index, slot }) => (
            <div
              key={index}
              className="tarot-fan-position"
              style={{ transform: `rotate(${(slot - 12) * (140 / 24)}deg)` }}
            >
              <motion.button
                layoutId={picked.includes(index) ? undefined : `tarot-pick-${index}`}
                className="tarot-fan-card"
                type="button"
                disabled={picked.includes(index)}
                aria-label={t('pickCard', { number: index + 1 })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') swiped.current = false;
                }}
                onClick={() => {
                  if (!swiped.current) onPick(index);
                }}
              >
                {picked.includes(index) ? <span aria-hidden="true">✓</span> : null}
              </motion.button>
            </div>
          ))}
      </div>
      <div className="hero-actions">
        <Button variant="secondary" disabled={start === -12} onClick={() => move(-8)}>
          {t('previousCards')}
        </Button>
        <Button variant="secondary" disabled={start === 65} onClick={() => move(8)}>
          {t('nextCards')}
        </Button>
      </div>
    </div>
  );
}
