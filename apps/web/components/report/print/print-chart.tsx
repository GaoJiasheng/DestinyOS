'use client';
import { useTranslations } from 'next-intl';
import {
  BaziChartSchema,
  ZiweiChartSchema,
  QimenChartSchema,
  IchingChartSchema,
  TarotChartSchema,
  AstroChartSchema,
  VedicChartSchema,
  TAROT_SPREADS,
} from '@tianji/shared';
import { ZIWEI_POSITIONS } from '@/components/charts/ziwei-geometry';
import { NatalWheel } from '@/components/charts/natal-wheel';
import { VedicSouthChart } from '@/components/charts/vedic-south-chart';
/** Static vector charts retain the exact saved chart positions and translated domain labels. */
export function PrintChart({ chart }: { chart: unknown }) {
  const t = useTranslations();
  const b = BaziChartSchema.safeParse(chart);
  const z = ZiweiChartSchema.safeParse(chart);
  const q = QimenChartSchema.safeParse(chart);
  const h = IchingChartSchema.safeParse(chart);
  const a = AstroChartSchema.safeParse(chart);
  const v = VedicChartSchema.safeParse(chart);
  const r = TarotChartSchema.safeParse(chart);
  if (a.success) return <NatalWheel chart={a.data} />;
  if (v.success)
    return (
      <>
        <VedicSouthChart chart={v.data} />
        <div className="print-navamsa">
          <VedicSouthChart chart={v.data} division="D9" />
        </div>
      </>
    );
  return (
    <svg viewBox="0 0 680 680" role="img" aria-label={t('report.chart')} className="print-vector">
      <title>{t('report.chart')}</title>
      {b.success
        ? (['year', 'month', 'day', 'hour'] as const).map((key, i) => {
            const p = b.data.pillars[key];
            const x = i * 170;
            return (
              <g key={key}>
                <rect
                  x={x + 6}
                  y="90"
                  width="158"
                  height="390"
                  rx="8"
                  fill="var(--surface-1)"
                  stroke="var(--gold)"
                />
                <text x={x + 85} y="132" textAnchor="middle">
                  {t(`bazi.chart.${key}`)}
                </text>
                {p ? (
                  <>
                    <text
                      className="print-ganzhi"
                      x={x + 85}
                      y="240"
                      fill={`var(--wu-${p.stemElement})`}
                    >
                      {t(`bazi.stems.${p.stem}`)}
                    </text>
                    <text
                      className="print-ganzhi"
                      x={x + 85}
                      y="345"
                      fill={`var(--wu-${p.branchElement})`}
                    >
                      {t(`bazi.branches.${p.branch}`)}
                    </text>
                    <text x={x + 85} y="393" textAnchor="middle" fontSize="14">
                      {t(`bazi.tenGods.${p.tenGod}`)}
                    </text>
                    <text x={x + 85} y="430" textAnchor="middle" fontSize="14">
                      {p.hiddenStems.map((s) => t(`bazi.stems.${s.stem}`)).join(' · ')}
                    </text>
                  </>
                ) : (
                  <text x={x + 85} y="280" textAnchor="middle">
                    {t('common.unknown')}
                  </text>
                )}
              </g>
            );
          })
        : null}
      {z.success
        ? z.data.palaces.map((p) => {
            const [col, row] = ZIWEI_POSITIONS[p.branch];
            const x = col * 170,
              y = row * 170;
            const stars = [...p.majorStars, ...p.minorStars];
            return (
              <g key={p.index}>
                <rect
                  x={x + 1}
                  y={y + 1}
                  width="168"
                  height="168"
                  fill="var(--surface-1)"
                  stroke="var(--gold)"
                />
                <text x={x + 10} y={y + 23} fill="var(--gold-soft)" fontSize="15">
                  {t(`ziwei.chart.palace.${p.key}`)}
                </text>
                <text x={x + 158} y={y + 23} textAnchor="end" fontSize="12">
                  {t(`bazi.branches.${p.branch}`)}
                </text>
                {stars.map((s, i) => (
                  <text
                    key={s.key}
                    x={x + 10}
                    y={y + 43 + i * 13}
                    fontSize="10.5"
                    fill={i < p.majorStars.length ? 'var(--gold-soft)' : 'var(--text-2)'}
                  >
                    {t(`ziwei.chart.star.${s.key}`)}
                    {s.mutagen ? ` · ${t(`ziwei.chart.mutagen.${s.mutagen}`)}` : ''}
                  </text>
                ))}
              </g>
            );
          })
        : null}
      {q.success
        ? [4, 9, 2, 3, 5, 7, 8, 1, 6].map((index, i) => {
            const p = q.data.palaces.find((p) => p.index === index)!;
            const x = (i % 3) * 226,
              y = Math.floor(i / 3) * 226;
            const lines = [
              t(`divination.directions.${p.direction}`),
              p.deity ? t(`divination.symbols.${p.deity}`) : '',
              `${t(`divination.symbols.${p.star}`)} · ${t(`bazi.stems.${p.skyStem}`)}`,
              p.gate ? t(`divination.symbols.${p.gate}`) : '',
              `${t('divination.earth')} · ${t(`bazi.stems.${p.earthStem}`)}`,
            ];
            return (
              <g key={index}>
                <rect
                  x={x + 1}
                  y={y + 1}
                  width="224"
                  height="224"
                  fill="var(--surface-1)"
                  stroke="var(--gold)"
                />
                {lines.map((line, n) => (
                  <text key={n} x={x + 113} y={y + 40 + n * 35} textAnchor="middle" fontSize="17">
                    {line}
                  </text>
                ))}
              </g>
            );
          })
        : null}
      {h.success
        ? [h.data.primary, h.data.mutual, h.data.changing]
            .filter((p) => p != null)
            .map((p, i) => (
              <g key={i}>
                <text x={113 + i * 226} y="120" textAnchor="middle" fontSize="16">
                  {t(`divination.hexagrams.${p.key}`)}
                </text>
                {p.lines.map((yang, n) => (
                  <g
                    key={n}
                    transform={`translate(${28 + i * 226} ${440 - n * 45})`}
                    fill="var(--gold)"
                  >
                    {yang ? (
                      <rect width="170" height="9" />
                    ) : (
                      <>
                        <rect width="72" height="9" />
                        <rect x="98" width="72" height="9" />
                      </>
                    )}
                    {i === 0 && h.data.movingLines.includes(n + 1) ? (
                      <circle cx="184" cy="4" r="6" fill="none" stroke="var(--accent)" />
                    ) : null}
                  </g>
                ))}
              </g>
            ))
        : null}
      {r.success
        ? r.data.cards.map((card, i) => {
            const slot = TAROT_SPREADS[r.data.spread][i]!;
            const dense = r.data.cards.length > 5;
            const width = dense ? 92 : 160,
              height = dense ? 94 : 180;
            const x = slot.x * 680 - width / 2,
              y = slot.y * 680 - height / 2;
            // DESIGN-GAP: Print markers use compact labeled SVG cards; the intentional Celtic crossing is an outlined overlay with its label above the pair.
            const crossing = slot.rotation === 90;
            const name = t(`tarot.card.${card.cardKey}.name`);
            const lines = name.length > 22 ? [name.slice(0, 22), name.slice(22)] : [name];
            return (
              <g key={i} data-tarot-order={i}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx="5"
                  fill={crossing ? 'none' : 'var(--surface-1)'}
                  stroke="var(--gold)"
                  transform={crossing ? `rotate(90 ${x + width / 2} ${y + height / 2})` : undefined}
                />
                <text
                  x={x + width / 2}
                  y={crossing ? y - 20 : y + 20}
                  textAnchor="middle"
                  fontSize={dense ? 10 : 12}
                >
                  {t(`tarot.position.${r.data.spread}.${slot.key}.name`)}
                </text>
                {!dense ? (
                  <path
                    d={`M ${x + 80} ${y + 35} l 28 25 l -28 25 l -28 -25 Z`}
                    fill="none"
                    stroke="var(--gold)"
                  />
                ) : null}
                {lines.map((line, n) => (
                  <text
                    key={n}
                    x={x + width / 2}
                    y={crossing ? y - 6 + n * 12 : y + height - 50 + n * 13}
                    textAnchor="middle"
                    fontSize={dense ? 10 : 12}
                  >
                    {line}
                  </text>
                ))}
                <text
                  x={x + width / 2}
                  y={crossing ? y + height + 16 : y + height - 12}
                  textAnchor="middle"
                  fontSize={dense ? 10 : 12}
                >
                  {t(card.reversed ? 'tarot.reversed' : 'tarot.upright')}
                </text>
              </g>
            );
          })
        : null}
    </svg>
  );
}
