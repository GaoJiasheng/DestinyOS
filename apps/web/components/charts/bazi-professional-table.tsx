'use client';
import type { ReactNode } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { PILLAR_KEYS, isHighlighted, type BaziChartProps } from './bazi-shared';

/** Show every documented pillar field, per-pillar special markers, and calculation intermediates. */
export function BaziProfessionalTable({ chart, highlight }: BaziChartProps) {
  const t = useCopy();
  const rows = [
    'stem',
    'branch',
    'hiddenStems',
    'tenGod',
    'naYin',
    'lifeStage',
    'shenSha',
    'void',
  ] as const;
  return (
    <section
      className="bazi-component bazi-professional"
      data-chart-path="professional"
      tabIndex={-1}
    >
      <div
        className="bazi-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={t('bazi.chart.fullTable')}
      >
        <table className="bazi-full-table">
          <caption>{t('bazi.chart.fullTable')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('bazi.chart.field')}</th>
              {PILLAR_KEYS.map((key) => (
                <th scope="col" key={key}>
                  {t(`bazi.chart.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row} data-field={row}>
                <th scope="row">{t(`bazi.chart.${row}`)}</th>
                {PILLAR_KEYS.map((key) => {
                  const pillar = chart.pillars[key];
                  let value: ReactNode = t('common.unknown');
                  if (pillar) {
                    switch (row) {
                      case 'stem':
                        value = (
                          <span>
                            <span
                              className="bazi-dot"
                              aria-hidden="true"
                              style={{ background: `var(--wu-${pillar.stemElement})` }}
                            />
                            {t(`bazi.stems.${pillar.stem}`)} ·{' '}
                            {t(`bazi.elements.${pillar.stemElement}`)}
                          </span>
                        );
                        break;
                      case 'branch':
                        value = (
                          <span>
                            <span
                              className="bazi-dot"
                              aria-hidden="true"
                              style={{ background: `var(--wu-${pillar.branchElement})` }}
                            />
                            {t(`bazi.branches.${pillar.branch}`)} ·{' '}
                            {t(`bazi.elements.${pillar.branchElement}`)}
                          </span>
                        );
                        break;
                      case 'hiddenStems':
                        value = (
                          <ul>
                            {pillar.hiddenStems.map((hidden) => (
                              <li key={hidden.stem}>
                                {t(`bazi.stems.${hidden.stem}`)} · {t(`bazi.chart.${hidden.role}`)}{' '}
                                · {t(`bazi.tenGods.${hidden.tenGod}`)}
                              </li>
                            ))}
                          </ul>
                        );
                        break;
                      case 'tenGod':
                        value = t(`bazi.tenGods.${pillar.tenGod}`);
                        break;
                      case 'naYin':
                        value = t(`bazi.naYin.${pillar.naYin}`);
                        break;
                      case 'lifeStage':
                        value = t(`bazi.lifeStages.${pillar.lifeStage}`);
                        break;
                      case 'shenSha':
                        value =
                          chart.shenSha
                            .filter((hit) => hit.hitsPillar.includes(key))
                            .map((hit) => t(`bazi.shenSha.${hit.name}`))
                            .join(' · ') || t('bazi.chart.none');
                        break;
                      case 'void':
                        value = t(pillar.isVoid ? 'bazi.chart.isVoid' : 'bazi.chart.notVoid');
                        break;
                    }
                  }
                  return (
                    <td
                      key={key}
                      data-pillar={key}
                      className={
                        isHighlighted(highlight, `pillars.${key}.${row}`)
                          ? 'chart-highlight'
                          : undefined
                      }
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {t('bazi.chart.voidBranches', {
          branches: chart.voidBranches.map((branch) => t(`bazi.branches.${branch}`)).join(' · '),
        })}
      </p>
      <dl className="bazi-intermediates">
        {(['prevJie', 'nextJie'] as const).map((key) => (
          <div key={key}>
            <dt>{t(`bazi.chart.${key}`)}</dt>
            <dd>
              {t(`bazi.solarTerms.${chart.solarTerms[key].name}`)} ·{' '}
              {t('report.content', { text: chart.solarTerms[key].at })}
            </dd>
          </div>
        ))}
        <div>
          <dt>{t('bazi.chart.solarAdjust')}</dt>
          <dd>
            {chart.solarTimeAdjust.offsetMinutes === null
              ? t('common.unknown')
              : t('bazi.chart.minutes', {
                  value: chart.solarTimeAdjust.offsetMinutes.toFixed(2),
                })}{' '}
            · {t(chart.solarTimeAdjust.enabled ? 'bazi.chart.enabled' : 'bazi.chart.disabled')}
          </dd>
        </div>
      </dl>
    </section>
  );
}
