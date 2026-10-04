'use client';
import { useCopy } from '@/i18n/use-copy';
function rows(value: unknown, path = ''): Array<{ path: string; value: string }> {
  if (value === null || typeof value !== 'object')
    return [{ path, value: value === undefined ? '—' : String(value) }];
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value);
  return entries.flatMap(([key, item]) => rows(item, path ? `${path}.${key}` : key));
}
/** Render every nested calculation field as an accessible, scrollable table without hiding arrays or intermediate values. */
export function ProfessionalData({ value }: { value: unknown }) {
  const t = useCopy();
  return (
    <div className="technical-table-wrap">
      <table className="technical-table">
        <thead>
          <tr>
            <th>{t('report.dataPath')}</th>
            <th>{t('report.dataValue')}</th>
          </tr>
        </thead>
        <tbody>
          {rows(value).map((row, i) => (
            <tr key={i}>
              <th scope="row">{t('report.content', { text: row.path })}</th>
              <td>{t('report.content', { text: row.value })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
