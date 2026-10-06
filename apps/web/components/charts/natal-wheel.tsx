'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AstroChart, Planet } from '@tianji/shared';
import { closestBodyKey } from './chart-hit-target';
import {
  aspectColor,
  bodyFromEvidence,
  houseFromEvidence,
  PLANET_GLYPHS,
  SIGN_GLYPHS,
  SIGNS,
  spreadLongitudes,
  wheelPoint,
  wrap,
} from './astro-geometry';
/** Natal SVG wheel: degree positions are immutable while colliding glyphs move at least seven degrees apart. */
export function NatalWheel({
  chart,
  highlight,
  onSelect,
}: {
  chart: AstroChart;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
}) {
  const t = useTranslations();
  const [selected, setSelected] = useState<Planet>();
  const [hovered, setHovered] = useState<Planet>();
  const activeHouse = houseFromEvidence(chart.houses ?? [], highlight);
  const active = hovered ?? bodyFromEvidence(chart.bodies, highlight) ?? selected;
  // DESIGN-GAP: Noon wheels anchor 0° Aries at nine o'clock without fabricating an ASC.
  const asc = chart.noonChart ? 0 : (chart.angles?.asc ?? 0);
  const select = (key: Planet) => {
    setSelected(key);
    onSelect?.(
      key === 'sun' || key === 'moon' ? 'big_three' : 'planets',
      `bodies.${chart.bodies.findIndex((b) => b.key === key)}`,
    );
  };
  return (
    <div className="natal-art-board">
      <ChartArt system="astrology" />
      <svg
        className="natal-wheel"
        viewBox="0 0 400 400"
        role="group"
        aria-label={t('charts.natal.title')}
        data-house-system={chart.houseSystem}
      >
        <title>{t('charts.natal.title')}</title>
        <circle
          cx="200"
          cy="200"
          r="183"
          fill="var(--surface-1)"
          fillOpacity="0.4"
          stroke="var(--gold)"
        />
        <g className="zodiac-ring">
          {SIGNS.map((sign, i) => {
            const a = wheelPoint(i * 30, asc, 181),
              b = wheelPoint(i * 30 + 30, asc, 181);
            const c = wheelPoint(i * 30 + 30, asc, 149),
              d = wheelPoint(i * 30, asc, 149);
            const p = wheelPoint(i * 30 + 15, asc, 165);
            return (
              <g key={sign}>
                <path
                  d={`M ${a.x} ${a.y} A 181 181 0 0 0 ${b.x} ${b.y} L ${c.x} ${c.y} A 149 149 0 0 1 ${d.x} ${d.y} Z`}
                  fill={`var(--element-${['fire', 'earth', 'air', 'water'][i % 4]})`}
                  fillOpacity="0.15"
                  stroke="var(--line-2)"
                />
                <text x={p.x} y={p.y} className="zodiac-glyph">
                  <title>{t(`charts.sign.${sign}`)}</title>
                  {`${SIGN_GLYPHS[i]}︎`}
                </text>
              </g>
            );
          })}
          {Array.from({ length: 72 }, (_, i) => {
            const a = wheelPoint(i * 5, asc, 149),
              b = wheelPoint(i * 5, asc, i % 6 === 0 ? 139 : 145);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--gold)"
                strokeOpacity="0.6"
              />
            );
          })}
        </g>
        {!chart.noonChart &&
          chart.houses?.map((house, i, houses) => {
            const a = wheelPoint(house.cusp, asc, 90),
              b = wheelPoint(house.cusp, asc, 139);
            const p = wheelPoint(
              house.cusp + wrap(houses[(i + 1) % 12]!.cusp - house.cusp) / 2,
              asc,
              132,
            );
            return (
              <g
                key={house.index}
                data-chart-path={`houses.${i}`}
                data-house={house.index}
                role="button"
                tabIndex={0}
                aria-label={t('charts.houseNumber', { number: house.index })}
                onClick={() => onSelect?.('houses', `houses.${i}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.('houses', `houses.${i}`);
                  }
                }}
                className={activeHouse === i ? 'chart-selected' : undefined}
              >
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line-2)" />
                {/* DESIGN-GAP: Invisible 64-unit targets preserve wheel artwork while meeting 44px at the mobile chart scale. */}
                <circle className="chart-hit-target" cx={p.x} cy={p.y} r="32" fill="transparent" />
                <text x={p.x} y={p.y} className="house-number">
                  {house.index}
                </text>
              </g>
            );
          })}
        {!chart.noonChart &&
          chart.angles &&
          Object.entries(chart.angles).map(([key, lon]) => {
            const p = wheelPoint(lon, asc, 193);
            return (
              <text key={key} x={p.x} y={p.y} className="axis-label">
                {t(`charts.angle.${key}`)}
              </text>
            );
          })}
        <g className="aspect-lines" aria-hidden="true">
          {chart.aspects.map((aspect, i) => {
            const aBody = chart.bodies.find((b) => b.key === aspect.a),
              bBody = chart.bodies.find((b) => b.key === aspect.b);
            if (!aBody || !bBody) return null;
            const a = wheelPoint(aBody.lon, asc, 88),
              b = wheelPoint(bBody.lon, asc, 88);
            const involved = aspect.a === active || aspect.b === active;
            return (
              <line
                key={i}
                data-aspect={aspect.type}
                data-active={involved}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={aspectColor(aspect.type)}
                strokeWidth={involved ? 2.5 : 1}
                opacity={active ? (involved ? 1 : 0.12) : aspect.major ? 0.7 : 0.3}
                strokeDasharray={aspect.major ? undefined : '3 3'}
              />
            );
          })}
        </g>
        <g className="planet-ring">
          {spreadLongitudes(chart.bodies).map((body) => {
            const p = wheelPoint(body.displayLon, asc, 113),
              truePoint = wheelPoint(body.lon, asc, 90);
            const label = `${t(`charts.planet.${body.key}`)} · ${t(`charts.sign.${chart.bodies.find((b) => b.key === body.key)!.sign}`)} · ${chart.bodies.find((b) => b.key === body.key)!.degInSign.toFixed(1)}°`;
            return (
              <g
                key={body.key}
                data-chart-path={`bodies.${chart.bodies.findIndex((b) => b.key === body.key)}`}
                data-body={body.key}
                data-true-lon={body.lon}
                data-display-lon={body.displayLon}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={active === body.key}
                className={active === body.key ? 'chart-selected planet-target' : 'planet-target'}
                onMouseEnter={() => setHovered(body.key)}
                onMouseLeave={() => setHovered(undefined)}
                onFocus={() => setHovered(body.key)}
                onBlur={() => setHovered(undefined)}
                onClick={(e) =>
                  select(
                    closestBodyKey(
                      e.currentTarget,
                      { x: e.clientX, y: e.clientY },
                      chart.bodies.map((b) => b.key),
                      body.key,
                    ),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(body.key);
                  }
                }}
              >
                <title>{label}</title>
                <circle className="chart-hit-target" cx={p.x} cy={p.y} r="32" fill="transparent" />
                <line
                  x1={truePoint.x}
                  y1={truePoint.y}
                  x2={p.x}
                  y2={p.y}
                  stroke="var(--gold)"
                  strokeOpacity="0.45"
                />
                <circle cx={truePoint.x} cy={truePoint.y} r="2" fill="var(--gold)" />
                <circle cx={p.x} cy={p.y} r="12" fill="var(--surface-1)" />
                <text x={p.x} y={p.y} className="planet-glyph">
                  {`${PLANET_GLYPHS[body.key]}︎`}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
import { ChartArt } from '@/components/art/chart-art';
