'use client';
import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { TarotChart } from '@tianji/shared';
type Card = TarotChart['cards'][number];
/** Lazy face image with a 600ms 3D reveal followed by a 300ms reversal, respecting reduced motion. */
export function TarotCard({
  card,
  revealed = false,
  position,
  onReveal,
  layoutId,
}: {
  card?: Card;
  revealed?: boolean;
  position: string;
  onReveal?: () => void;
  layoutId?: string;
}) {
  const t = useTranslations('tarot');
  // DESIGN-GAP: An uncached face image offline falls back to the translated card name and orientation.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const name = card ? t(`card.${card.cardKey}.name`) : '';
  const label =
    revealed && card
      ? t('cardLabel', { position, name, orientation: t(card.reversed ? 'reversed' : 'upright') })
      : t(onReveal ? 'flipCard' : 'faceDown', { position });
  const content = (
    <span className={`tarot-flipper ${revealed ? 'is-revealed' : ''}`}>
      <span className="tarot-back">
        <Image src="/tarot/card-back.svg" width={343} height={600} alt="" />
      </span>
      <span className="tarot-face">
        {revealed && card && failedKey === card.cardKey ? (
          <span className="tarot-face-fallback">
            {name}
            <br />
            {t(card.reversed ? 'reversed' : 'upright')}
          </span>
        ) : revealed && card ? (
          <Image
            className={card.reversed ? 'is-reversed' : ''}
            src={`/tarot/rws/${card.cardKey}.webp`}
            width={343}
            height={600}
            alt={name}
            unoptimized
            onError={() => setFailedKey(card.cardKey)}
          />
        ) : null}
      </span>
    </span>
  );
  return (
    <motion.div
      layoutId={layoutId}
      className="tarot-card"
      data-card={revealed ? card?.cardKey : undefined}
      data-reversed={revealed ? card?.reversed : undefined}
    >
      {onReveal ? (
        <button type="button" aria-label={label} onClick={onReveal} disabled={revealed}>
          {content}
        </button>
      ) : (
        <div role="img" aria-label={label}>
          {content}
        </div>
      )}
    </motion.div>
  );
}
