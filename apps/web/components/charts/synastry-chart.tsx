'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SynastryChart } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { BaziPillars } from './bazi-pillars';
import { NatalWheel } from './natal-wheel';
import {
  wheelPoint,
  spreadLongitudes,
  PLANET_GLYPHS,
  SIGN_GLYPHS,
  aspectColor,
} from './astro-geometry';
/** SVG paired wheels, deterministic pillar tables, complete Guna breakdown and auditable cross-chart comparisons. */
export function SynastryChartView({
  chart,
  print = false,
}: {
  chart: SynastryChart;
  print?: boolean;
}) {
  const t = useCopy(),
    intl = useTranslations(),
    [overlay, setOverlay] = useState(true);
  const number = (value: number) => intl('common.number', { value: Math.round(value * 100) / 100 });
  const trait = (value: string) =>
    /^\d+$/.test(value) ? number(Number(value)) : intl(`synastry.trait.${value}`);
  const aspects = (rows: SynastryChart['western']['aspects']) => (
    <div className="technical-data">
      <table>
        <thead>
          <tr>
            <th>{t('synastry.a')}</th>
            <th>{t('synastry.b')}</th>
            <th>{t('synastry.aspects')}</th>
            <th>{t('synastry.orb')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{intl(`charts.planet.${r.a}`)}</td>
              <td>{intl(`charts.planet.${r.b}`)}</td>
              <td>{intl(`charts.aspect.${r.type}`)}</td>
              <td>{number(r.orb)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p>{t('synastry.empty')}</p> : null}
    </div>
  );
  const asc = chart.a.astrology.angles?.asc ?? 0;
  return (
    <div id="chart-root" className="synastry-chart" tabIndex={-1}>
      {chart.ashtakoot.provisional ? <p role="status">{t('synastry.provisional')}</p> : null}
      {!chart.availability.housesA || !chart.availability.housesB ? (
        <p>{t('synastry.noHouses')}</p>
      ) : null}
      {!print ? (
        <div className="hero-actions">
          <Button variant="secondary" aria-pressed={overlay} onClick={() => setOverlay(true)}>
            {t('synastry.overlay')}
          </Button>
          <Button variant="secondary" aria-pressed={!overlay} onClick={() => setOverlay(false)}>
            {t('synastry.sideBySide')}
          </Button>
        </div>
      ) : null}
      {overlay ? (
        <svg
          viewBox="0 0 400 400"
          role="img"
          aria-label={t('synastry.wheel')}
          className="natal-wheel"
        >
          <title>{t('synastry.wheel')}</title>
          <circle cx="200" cy="200" r="190" fill="none" stroke="var(--gold)" />
          <circle cx="200" cy="200" r="146" fill="none" stroke="var(--line-2)" />
          <circle cx="200" cy="200" r="115" fill="none" stroke="var(--line-2)" />
          {SIGN_GLYPHS.map((g, i) => {
            const p = wheelPoint(i * 30 + 15, asc, 179),
              line = wheelPoint(i * 30, asc, 190),
              inner = wheelPoint(i * 30, asc, 159);
            return (
              <g key={i}>
                <line x1={line.x} y1={line.y} x2={inner.x} y2={inner.y} stroke="var(--line-2)" />
                <text x={p.x} y={p.y} textAnchor="middle" fill="var(--text-1)">
                  {g}
                </text>
              </g>
            );
          })}
          {chart.western.intimateAspects.map((e, i) => {
            const a = chart.a.astrology.bodies.find((p) => p.key === e.a)!,
              b = chart.b.astrology.bodies.find((p) => p.key === e.b)!,
              pa = wheelPoint(a.lon, asc, 146),
              pb = wheelPoint(b.lon, asc, 115);
            return (
              <line
                key={i}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={aspectColor(e.type)}
                opacity=".45"
              />
            );
          })}
          {(['a', 'b'] as const).map((side, index) =>
            spreadLongitudes(chart[side].astrology.bodies).map((p) => {
              const radius = index ? 115 : 146,
                point = wheelPoint(p.displayLon, asc, radius),
                truePoint = wheelPoint(p.lon, asc, radius - 10);
              return (
                <g key={`${side}-${p.key}`}>
                  <title>{`${t(`synastry.${side}`)} · ${intl(`charts.planet.${p.key}`)} · ${number(p.lon)}`}</title>
                  <line
                    x1={truePoint.x}
                    y1={truePoint.y}
                    x2={point.x}
                    y2={point.y}
                    stroke={index ? 'var(--element-water)' : 'var(--gold)'}
                  />
                  <text
                    x={point.x}
                    y={point.y}
                    textAnchor="middle"
                    fontSize="16"
                    fill={index ? 'var(--element-water)' : 'var(--gold)'}
                  >
                    {PLANET_GLYPHS[p.key]}
                  </text>
                </g>
              );
            }),
          )}
          <text x="200" y="203" textAnchor="middle" fill="var(--text-1)">
            {t('nav.synastry')}
          </text>
        </svg>
      ) : (
        <div className="synastry-pair">
          {(['a', 'b'] as const).map((side) => (
            <section key={side}>
              <h3>{t(`synastry.${side}`)}</h3>
              <NatalWheel chart={chart[side].astrology} />
            </section>
          ))}
        </div>
      )}
      <h3>{t('synastry.bazi')}</h3>
      <div className="synastry-pair">
        {(['a', 'b'] as const).map((side) => (
          <section key={side}>
            <h4>{t(`synastry.${side}`)}</h4>
            <BaziPillars chart={chart[side].bazi} />
          </section>
        ))}
      </div>
      <p>
        {t('synastry.complementarity', { score: Math.round(chart.bazi.elementComplementarity) })}
      </p>
      <p>
        {t('synastry.support')}: {number(chart.bazi.favorableSupport[0])} /{' '}
        {number(chart.bazi.favorableSupport[1])}
      </p>
      <h3>{t('synastry.guna')}</h3>
      <svg
        viewBox="0 0 240 150"
        role="img"
        aria-label={t('synastry.gunaScore', { score: chart.ashtakoot.total })}
      >
        <title>{t('synastry.gunaScore', { score: chart.ashtakoot.total })}</title>
        <path
          d="M20 120 A100 100 0 0 1 220 120"
          pathLength="36"
          fill="none"
          stroke="var(--line-2)"
          strokeWidth="12"
        />
        <path
          d="M20 120 A100 100 0 0 1 220 120"
          pathLength="36"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="12"
          strokeDasharray={`${chart.ashtakoot.total} 36`}
        />
        <text x="120" y="105" textAnchor="middle" fill="var(--text-1)" fontSize="24">
          {number(chart.ashtakoot.total)} / 36
        </text>
      </svg>
      <div className="technical-data">
        <table>
          <thead>
            <tr>
              <th>{t('synastry.guna')}</th>
              <th>{t('synastry.a')}</th>
              <th>{t('synastry.b')}</th>
              <th>{t('synastry.score')}</th>
              <th>{t('synastry.max')}</th>
            </tr>
          </thead>
          <tbody>
            {chart.ashtakoot.kootas.map((k) => (
              <tr key={k.key}>
                <th>{t(`synastry.koota.${k.key}`)}</th>
                <td>{trait(k.a)}</td>
                <td>{trait(k.b)}</td>
                <td>{number(k.score)}</td>
                <td>{number(k.max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>{t('synastry.intimate')}</h3>
      {aspects(chart.western.intimateAspects)}
      <details open={print}>
        <summary>{t('synastry.aspects')}</summary>
        {aspects(chart.western.aspects)}
      </details>
      <details open={print}>
        <summary>{t('synastry.overlays')}</summary>
        <ul>
          {chart.western.overlays.map((o) => (
            <li key={`${o.from}-${o.planet}`}>
              {t(`synastry.${o.from}`)} · {intl(`charts.planet.${o.planet}`)} →{' '}
              {t(`synastry.${o.from === 'a' ? 'b' : 'a'}`)} ·{' '}
              {t('synastry.house', { house: o.house })}
            </li>
          ))}
        </ul>
      </details>
      <details open={print}>
        <summary>{t('synastry.tenGods')}</summary>
        <ul>
          {chart.bazi.tenGodInteractions.map((r) => (
            <li key={`${r.observer}-${r.pillar}`}>
              {t(`synastry.${r.observer}`)} · {intl(`bazi.chart.${r.pillar}`)} ·{' '}
              {intl(`bazi.tenGods.${r.stemGod}`)} ·{' '}
              {r.hiddenGods.map((g) => intl(`bazi.tenGods.${g}`)).join(' / ')}
            </li>
          ))}
        </ul>
      </details>
      <details open={print}>
        <summary>{t('synastry.spouseStars')}</summary>
        <ul>
          {chart.bazi.spouseStars.map((r) => (
            <li key={r.observer}>
              {t(`synastry.${r.observer}`)} ·{' '}
              {r.expected.map((g) => intl(`bazi.tenGods.${g}`)).join(' / ')} ·{' '}
              {r.matches.length
                ? r.matches.map((p) => intl(`bazi.chart.${p}`)).join(' / ')
                : t('synastry.empty')}
            </li>
          ))}
        </ul>
      </details>
      <h3>{t('synastry.ziwei')}</h3>
      {chart.ziwei ? (
        <>
          <div className="technical-data">
            <table>
              <thead>
                <tr>
                  <th>{t('synastry.ziwei')}</th>
                  <th>{t('synastry.a')}</th>
                  <th>{t('synastry.b')}</th>
                </tr>
              </thead>
              <tbody>
                {chart.ziwei.comparisons.map((p) => (
                  <tr key={p.palace}>
                    <th>{intl(`ziwei.chart.palace.${p.palace}`)}</th>
                    <td>
                      {p.a.map((s) => intl(`ziwei.chart.star.${s}`)).join(' / ') ||
                        t('synastry.empty')}
                    </td>
                    <td>
                      {p.b.map((s) => intl(`ziwei.chart.star.${s}`)).join(' / ') ||
                        t('synastry.empty')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details open={print}>
            <summary>{t('synastry.mutagens')}</summary>
            <ul>
              {chart.ziwei.transformations.map((r, i) => (
                <li key={i}>
                  {t(`synastry.${r.from}`)} · {intl(`ziwei.chart.star.${r.star}`)} ·{' '}
                  {intl(`ziwei.chart.mutagen.${r.mutagen}`)} →{' '}
                  {intl(`ziwei.chart.palace.${r.target}`)}
                  {r.inLifeTriangle ? ` · ${t('synastry.lifeTriangle')}` : ''}
                  {r.inSpouseTriangle ? ` · ${t('synastry.spouseTriangle')}` : ''}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p>{t('synastry.noZiwei')}</p>
      )}
    </div>
  );
}
