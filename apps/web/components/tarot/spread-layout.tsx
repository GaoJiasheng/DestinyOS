'use client';
import { useTranslations } from 'next-intl';
import { TAROT_SPREADS, type SpreadKey, type TarotChart } from '@tianji/shared';
import { TarotCard } from './tarot-card';
/** Coordinate thumbnail shared by selection and the mobile report overview. */
export function SpreadThumbnail({ spread }: { spread: SpreadKey }) {
  const t = useTranslations('tarot');
  return (
    <svg className="tarot-thumbnail" viewBox="0 0 100 100" role="img" aria-label={t('layout')}>
      {TAROT_SPREADS[spread].map((p) => (
        <rect
          key={p.key}
          x={p.x * 80 + 4}
          y={p.y * 80}
          width="12"
          height="21"
          rx="1"
          transform={`rotate(${p.rotation} ${p.x * 80 + 10} ${p.y * 80 + 10.5})`}
        />
      ))}
    </svg>
  );
}
/** Desktop coordinates and mobile stacked positions; shared layout IDs move selected backs into slots. */
export function SpreadLayout({
  spread,
  cards = [],
  picked = [],
  revealed,
  onReveal,
}: {
  spread: SpreadKey;
  cards?: TarotChart['cards'];
  picked?: number[];
  revealed?: number[];
  onReveal?: (order: number) => void;
}) {
  const t = useTranslations('tarot');
  return (
    <div className={`tarot-spread tarot-spread-${spread}`}>
      <div className="tarot-mobile-map">
        <SpreadThumbnail spread={spread} />
      </div>
      <ol className="tarot-positions">
        {TAROT_SPREADS[spread].map((p, i) => (
          <li key={p.key} style={{ left: `${p.x * 82 + 9}%`, top: `${p.y * 75 + 12}%` }}>
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
