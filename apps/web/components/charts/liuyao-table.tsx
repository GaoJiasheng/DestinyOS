'use client';
import type { IchingChart } from '@tianji/shared';
import { useTranslations } from 'next-intl';
/** Jingfang installation with changed lines, hidden spirits, Shi/Ying and use-god labels. */
export function LiuyaoTable({ chart }: { chart: IchingChart }) {
  const t = useTranslations('divination');
  const b = useTranslations('bazi');
  const l = chart.liuyao;
  if (!l) return null;
  return (
    <div className="divination-table-scroll" data-testid="liuyao-table" tabIndex={0}>
      <p>
        {t('useGod')} · {t(`relatives.${l.useGod.relative}`)} · {t(`states.${l.useGod.state}`)}
      </p>
      <p>
        {t('void')} · {l.voidBranches.map((v) => b(`branches.${v}`)).join(' / ')}
      </p>
      <table className="divination-table">
        <caption>{t('installation')}</caption>
        <thead>
          <tr>
            {['position', 'spirit', 'relative', 'naJia', 'shiYing', 'changing', 'hidden'].map(
              (k) => (
                <th key={k}>{t(k)}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {[...l.lines].reverse().map((line) => (
            <tr
              key={line.position}
              className={l.useGod.lines.includes(line.position) ? 'chart-highlight' : ''}
            >
              <th>
                {line.position}
                {line.moving ? (line.yang ? ' ○' : ' ×') : ''}
              </th>
              <td>{t(`spirits.${line.spirit}`)}</td>
              <td>{t(`relatives.${line.relative}`)}</td>
              <td>
                {b(`stems.${line.stem}`)}
                {b(`branches.${line.branch}`)} · {b(`elements.${line.element}`)}
              </td>
              <td>{line.isShi ? t('shi') : line.isYing ? t('ying') : '—'}</td>
              <td>
                {line.changedTo
                  ? `${b(`stems.${line.changedTo.stem}`)}${b(`branches.${line.changedTo.branch}`)} · ${t(`relatives.${line.changedTo.relative}`)}`
                  : '—'}
              </td>
              <td>
                {l.hidden
                  .filter((h) => h.underLine === line.position)
                  .map(
                    (h) =>
                      `${t(`relatives.${h.relative}`)} ${b(`stems.${h.stem}`)}${b(`branches.${h.branch}`)}`,
                  )
                  .join(' / ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
