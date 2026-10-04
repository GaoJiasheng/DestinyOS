'use client';
import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TarotDeck } from './tarot-deck';
/** Drag to split into three piles; keyboard users can split and choose the same merge order. */
export function TarotCut({ onDone }: { onDone: (order: number[]) => void }) {
  const t = useTranslations('tarot');
  const [split, setSplit] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  return (
    <div>
      <p>{t('cutHelp')}</p>
      {!split ? (
        <>
          <motion.div
            className="tarot-cut-drag"
            drag="x"
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 25) setSplit(true);
            }}
          >
            <TarotDeck />
          </motion.div>
          <Button onClick={() => setSplit(true)}>{t('split')}</Button>
        </>
      ) : (
        <div className="tarot-piles">
          {[0, 1, 2].map((pile) => (
            <button
              key={pile}
              type="button"
              disabled={order.includes(pile)}
              onClick={() => setOrder((current) => [...current, pile])}
            >
              <div className="tarot-pile-back" />
              {t('pile', { number: pile + 1 })}
              {order.includes(pile) ? (
                <span className="tarot-pile-order">{order.indexOf(pile) + 1}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      <p role="status">{t('cutOrder', { order: order.map((i) => i + 1).join(' → ') || '—' })}</p>
      <div className="hero-actions">
        <Button disabled={order.length !== 3} onClick={() => onDone(order)}>
          {t('next')}
        </Button>
        <Button variant="secondary" onClick={() => onDone([])}>
          {t('skip')}
        </Button>
      </div>
    </div>
  );
}
