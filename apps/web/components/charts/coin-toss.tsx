'use client';
import { useTranslations } from 'next-intl';
/** CSS 3D coin faces match the seeded yang-face count; speed is 1.2s or 0.4s per throw. */
export function CoinToss({
  count,
  tossing,
  fast = false,
  round,
}: {
  count: number;
  tossing: boolean;
  fast?: boolean;
  round: number;
}) {
  const t = useTranslations('divination');
  return (
    <div className="coin-toss" role="img" aria-label={t('coinsLabel', { round, count })}>
      {[0, 1, 2].map((i) => (
        <div className="coin-perspective" key={`${round}-${i}`}>
          <div
            className={`coin ${tossing ? 'coin-falling' : ''} ${i < count ? '' : 'coin-reverse'}`}
            style={{ animationDuration: fast ? '400ms' : '1200ms' }}
          >
            <span className="coin-face coin-front">
              <span>{t('coinInscription')}</span>
              <i />
            </span>
            <span className="coin-face coin-back">
              <svg viewBox="0 0 80 80" aria-hidden="true">
                <path d="M20 18v44m-6-32h12m-12 16h12m28-28v44m-6-32h12m-12 16h12M30 18h20M30 62h20" />
              </svg>
              <i />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
