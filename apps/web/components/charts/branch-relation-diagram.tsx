'use client';
import { BRANCH_RELATION_POINTS as POINTS } from '@tianji/ui-core';
import { useCopy } from '@/i18n/use-copy';
import { PILLAR_KEYS, isHighlighted, type BaziChartProps } from './bazi-shared';

/** Draw natal branch relations on a diamond, retaining three-way and repeated-branch pillar identities. */
export function BranchRelationDiagram({ chart, highlight, onSelect }: BaziChartProps) {
  const t = useCopy();
  return (
    <section className="bazi-component" data-chart-path="relations" tabIndex={-1}>
      <h3>{t('bazi.chart.relations')}</h3>
      <svg
        viewBox="0 0 300 300"
        className="bazi-relations"
        role="group"
        aria-label={t('bazi.chart.relations')}
      >
        <path d="M150 40 260 150 150 260 40 150Z" fill="none" stroke="var(--line-2)" />
        {chart.relations.branches.map((relation, i) => {
          // DESIGN-GAP: 三合 is drawn as all three edges; 六破 shares the documented neutral dotted treatment of 刑害.
          const keys = PILLAR_KEYS.filter(
            (key) => relation.pillars.includes(key) && chart.pillars[key],
          );
          const pairs = keys.flatMap((a, n) => keys.slice(n + 1).map((b) => [a, b] as const));
          const style =
            relation.type === 'combine' || relation.type === 'tri_combine'
              ? 'combine'
              : relation.type === 'clash'
                ? 'clash'
                : 'neutral';
          return (
            <g
              key={i}
              data-relation-index={i}
              data-relation-type={relation.type}
              data-pillars={relation.pillars.join(' ')}
              className={`bazi-relation-${style}`}
              strokeWidth={isHighlighted(highlight, `relations.branches.${i}`) ? 4 : 2}
            >
              <title>{t(`bazi.relations.${relation.type}`)}</title>
              {pairs.map(([a, b]) => (
                <line
                  key={`${a}-${b}`}
                  x1={POINTS[a][0]}
                  y1={POINTS[a][1]}
                  x2={POINTS[b][0]}
                  y2={POINTS[b][1]}
                />
              ))}
            </g>
          );
        })}
        {PILLAR_KEYS.map((key) => {
          const pillar = chart.pillars[key];
          const [x, y] = POINTS[key];
          return (
            <g
              key={key}
              data-branch-node={key}
              role="button"
              tabIndex={0}
              data-chart-path={`pillars.${key}.branch`}
              aria-label={t('bazi.chart.branchNode', {
                pillar: t(`bazi.chart.${key}`),
                branch: pillar ? t(`bazi.branches.${pillar.branch}`) : t('common.unknown'),
              })}
              aria-pressed={isHighlighted(highlight, `pillars.${key}`)}
              onClick={() => onSelect?.(`pillars.${key}.branch`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect?.(`pillars.${key}.branch`);
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={30}
                fill="var(--surface-2)"
                stroke={
                  isHighlighted(highlight, `pillars.${key}`) ? 'var(--gold)' : 'var(--line-2)'
                }
              />
              <text x={x} y={y - 7} textAnchor="middle" className="bazi-ring-caption">
                {t(`bazi.chart.${key}`)}
              </text>
              <text
                x={x}
                y={y + 15}
                textAnchor="middle"
                fill={pillar ? `var(--wu-${pillar.branchElement})` : 'var(--text-2)'}
              >
                {pillar ? t(`bazi.branches.${pillar.branch}`) : t('common.unknown')}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="bazi-relation-list">
        {chart.relations.branches.map((relation, i) => (
          <li key={i}>
            <button
              type="button"
              data-chart-path={`relations.branches.${i}`}
              aria-pressed={isHighlighted(highlight, `relations.branches.${i}`)}
              onClick={() => onSelect?.(`relations.branches.${i}`)}
            >
              {t(`bazi.relations.${relation.type}`)} ·{' '}
              {relation.pillars
                .map((key) => PILLAR_KEYS.find((p) => p === key))
                .filter((key) => key !== undefined)
                .map((key) => t(`bazi.chart.${key}`))
                .join(' / ')}
              {relation.complete ? null : ` · ${t('bazi.chart.partial')}`}
            </button>
          </li>
        ))}
      </ul>
      {!chart.relations.branches.length ? (
        <p className="muted">{t('bazi.chart.noRelations')}</p>
      ) : null}
    </section>
  );
}
