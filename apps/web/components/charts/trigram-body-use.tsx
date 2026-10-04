'use client';
import type { IchingChart } from '@tianji/shared';
import { useTranslations } from 'next-intl';
/** Meihua body/use relations, including process, outcome and seasonal strength. */
export function TrigramBodyUse({ chart }: { chart: IchingChart }) {
  const t = useTranslations('divination');
  const m = chart.meihua;
  if (!m) return null;
  return (
    <table className="divination-table" data-testid="body-use">
      <caption>{t('bodyUse')}</caption>
      <tbody>
        <tr>
          <th>{t('body')}</th>
          <td>{t(`trigrams.${m.body}`)}</td>
        </tr>
        <tr>
          <th>{t('use')}</th>
          <td>{t(`trigrams.${m.use}`)}</td>
        </tr>
        <tr>
          <th>{t('relation')}</th>
          <td>{t(`relations.${m.relation}`)}</td>
        </tr>
        <tr>
          <th>{t('mutual')}</th>
          <td>{t(`relations.${m.mutualRelation}`)}</td>
        </tr>
        <tr>
          <th>{t('changing')}</th>
          <td>{t(`relations.${m.changingRelation}`)}</td>
        </tr>
        <tr>
          <th>{t('strength')}</th>
          <td>{t(`strengths.${m.seasonalStrength}`)}</td>
        </tr>
      </tbody>
    </table>
  );
}
