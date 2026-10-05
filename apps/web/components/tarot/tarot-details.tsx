'use client';
import { useTranslations } from 'next-intl';
import type { TarotChart } from '@tianji/shared';
import { TarotCard } from './tarot-card';
/** Card-by-card illustrated meanings, keywords, category context and expandable imagery/position tips. */
export function TarotDetails({ chart }: { chart: TarotChart }) {
  const t = useTranslations('tarot');
  return (
    <div className="tarot-details">
      {chart.cards.map((card) => (
        <article className="tarot-detail" key={card.position}>
          <TarotCard
            card={card}
            revealed
            position={t(`position.${chart.spread}.${card.position}.name`)}
          />
          <div>
            <h3>
              {t(`position.${chart.spread}.${card.position}.name`)} ·{' '}
              {t(`card.${card.cardKey}.name`)}
            </h3>
            <p className="eyebrow">{t(card.reversed ? 'reversed' : 'upright')}</p>
            <p>
              {t(`card.${card.cardKey}.${card.reversed ? 'keywordsReversed' : 'keywordsUpright'}`)}
            </p>
            <p>
              {t(`card.${card.cardKey}.${card.reversed ? 'meaningReversed' : 'meaningUpright'}`)}
            </p>
            <p>
              {t(
                `card.${card.cardKey}.byCategory.${chart.category}.${card.reversed ? 'reversed' : 'upright'}`,
              )}
            </p>
            <details>
              <summary>{t('imagery')}</summary>
              <p>{t(`card.${card.cardKey}.imagery`)}</p>
            </details>
            <details>
              <summary>{t('learn')}</summary>
              <p>{t(`position.${chart.spread}.${card.position}.meaning`)}</p>
              <p>{t(`position.${chart.spread}.${card.position}.readingTip`)}</p>
              {chart.spread === 'celtic_cross' && card.position === 'challenge' ? (
                <p>{t('crossTip')}</p>
              ) : null}
            </details>
          </div>
        </article>
      ))}
      <details>
        <summary>{t('seed')}</summary>
        {/* DESIGN-GAP: Replay seeds are user-provided machine identifiers; code semantics distinguish them from translated prose. */}
        <p className="tarot-seed">
          <code>{chart.seed}</code>
        </p>
        <p>{t('seedHelp')}</p>
      </details>
    </div>
  );
}
