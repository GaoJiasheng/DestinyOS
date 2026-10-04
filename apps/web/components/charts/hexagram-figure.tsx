'use client';
import type { Hexagram } from '@tianji/shared';
import { useTranslations } from 'next-intl';
/** Six lines in bottom-to-top engine order, with accessible moving-line descriptions. */
export function HexagramFigure({
  hexagram,
  movingLines = [],
  label = 'primary',
  animate = false,
}: {
  hexagram: Hexagram;
  movingLines?: number[];
  label?: string;
  animate?: boolean;
}) {
  const t = useTranslations('divination');
  return (
    <figure
      className={`hexagram-figure ${animate ? 'hexagram-enter' : ''}`}
      aria-label={t('hexagramLabel', { number: hexagram.number })}
    >
      <figcaption>
        {t(label)} · {t(`hexagrams.${hexagram.key}`)} ·{' '}
        {t('hexagramLabel', { number: hexagram.number })}
      </figcaption>
      <div className="hexagram-lines" aria-hidden="true">
        {hexagram.lines.map((yang, i) => (
          <div
            key={i}
            className={`hexagram-line ${movingLines.includes(i + 1) ? 'moving-line' : ''}`}
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <span className={yang ? 'yang-line' : 'yin-line'} />
            {movingLines.includes(i + 1) ? <b className="moving-mark">{yang ? '○' : '×'}</b> : null}
          </div>
        ))}
      </div>
      <ol className="sr-only">
        {hexagram.lines.map((yang, i) => (
          <li key={i}>
            {t('lineLabel', {
              position: i + 1,
              type: t(yang ? 'yang' : 'yin'),
              moving: movingLines.includes(i + 1) ? t('moving') : t('static'),
            })}
          </li>
        ))}
      </ol>
      <p className="muted">
        {t(`trigrams.${hexagram.upper}`)} / {t(`trigrams.${hexagram.lower}`)}
      </p>
    </figure>
  );
}
