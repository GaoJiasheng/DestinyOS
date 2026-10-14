'use client';
import { useTranslations } from 'next-intl';
import { TAROT_SPREADS, type SpreadKey, type TarotChart } from '@tianji/shared';
import { isHighlighted } from '@/components/charts/bazi-shared';
import { TarotCard } from './tarot-card';
import { SpreadThumbnail } from './spread-thumbnail';
export { SpreadThumbnail } from './spread-thumbnail';
/** Desktop coordinates and mobile stacked positions; shared layout IDs move selected backs into slots. */
export function SpreadLayout({
  spread,
  cards = [],
  picked = [],
  revealed,
  onReveal,
  highlight,
}: {
  spread: SpreadKey;
  cards?: TarotChart['cards'];
  picked?: number[];
  revealed?: number[];
  onReveal?: (order: number) => void;
  highlight?: string;
}) {
  const t = useTranslations('tarot');
  return (
    <div className={`tarot-spread tarot-spread-${spread}`}>
      <div className="tarot-mobile-map">
        <SpreadThumbnail spread={spread} />
      </div>
      <ol className="tarot-positions">
        {TAROT_SPREADS[spread].map((p, i) => (
          <li
            key={p.key}
            data-chart-path={`cards.${i}`}
            tabIndex={-1}
            className={isHighlighted(highlight, `cards.${i}`) ? 'evidence-highlight' : undefined}
            style={{ left: `${p.x * 82 + 9}%`, top: `${p.y * 75 + 12}%` }}
          >
            <div className="tarot-slot" style={{ transform: `rotate(${p.rotation}deg)` }}>
              {cards[i] || picked[i] !== undefined ? (
                <TarotCard
                  card={cards[i]}
                  position={t(`position.${spread}.${p.key}.name`)}
                  revealed={revealed === undefined || revealed.includes(i)}
                  onReveal={onReveal ? () => onReveal(i) : undefined}
                  layoutId={picked[i] !== undefined ? `tarot-pick-${picked[i]}` : undefined}
                />
              ) : (
                <div className="tarot-empty" aria-hidden="true" />
              )}
            </div>
            <p className="tarot-position-name">{t(`position.${spread}.${p.key}.name`)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
