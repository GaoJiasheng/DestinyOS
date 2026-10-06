'use client';
import { compassSector } from '@tianji/ui-core';
import type { Direction } from '@tianji/shared';
import { useTranslations } from 'next-intl';
const directions: Direction[] = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
];
/** Eight-direction SVG compass; favorable sectors include text as well as color. */
export function QimenCompass({
  favorableDirections,
  northUp,
}: {
  favorableDirections: Direction[];
  northUp: boolean;
}) {
  const t = useTranslations('divination');
  return (
    <figure className="qimen-compass">
      <figcaption>{t('compass')}</figcaption>
      <svg viewBox="0 0 300 300" role="img" aria-label={t('compass')}>
        {directions.map((d, i) => {
          const sector = compassSector(i, northUp);
          const good = favorableDirections.includes(d);
          return (
            <g key={d}>
              <path
                d={`M150 150 L${sector.start.x} ${sector.start.y} A110 110 0 0 1 ${sector.end.x} ${sector.end.y} Z`}
                className={good ? 'favorable-sector' : 'compass-sector'}
              />
              <text x={sector.label.x} y={sector.label.y} textAnchor="middle">
                {t(`directions.${d}`)}
                {good ? ' ✓' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="muted">
        {t('favorable')} ·{' '}
        {favorableDirections.map((d) => t(`directions.${d}`)).join(' / ') || t('none')}
      </p>
    </figure>
  );
}
