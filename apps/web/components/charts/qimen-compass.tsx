'use client';
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
          const angle = ((i * 45 + (northUp ? 0 : 180)) * Math.PI) / 180;
          const start = angle - Math.PI / 8;
          const end = angle + Math.PI / 8;
          const good = favorableDirections.includes(d);
          return (
            <g key={d}>
              <path
                d={`M150 150 L${150 + 110 * Math.sin(start)} ${150 - 110 * Math.cos(start)} A110 110 0 0 1 ${150 + 110 * Math.sin(end)} ${150 - 110 * Math.cos(end)} Z`}
                className={good ? 'favorable-sector' : 'compass-sector'}
              />
              <text
                x={150 + 130 * Math.sin(angle)}
                y={154 - 130 * Math.cos(angle)}
                textAnchor="middle"
              >
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
