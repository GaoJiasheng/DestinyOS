'use client';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { publishReleaseAction } from '@/app/admin/actions';
import type { publishRelease } from '@/lib/admin-knowledge';
/** Preflight and publication share the same selected draft set, notes and rollback source. */
export function ReleaseManager({
  drafts,
  releases,
}: {
  drafts: { id: string; unitId: string; version: number }[];
  releases: { version: string; notes: string | null; createdAt: string }[];
}) {
  const { pending, run: start } = useSubmitTransition();
  const t = useCopy(),
    [selected, setSelected] = useState(drafts.map((d) => d.id)),
    [notes, setNotes] = useState(''),
    [rollback, setRollback] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof publishRelease>> | null>(null),
    [error, setError] = useState('');
  const dirty = () => {
    setResult(null);
    setError('');
  };
  const perform = (dryRun: boolean) =>
    start(async () => {
      const response = await publishReleaseAction({
        draftIds: rollback ? [] : selected,
        notes,
        dryRun,
        ...(rollback ? { rollback } : {}),
      });
      if (response.ok) setResult(response.data);
      else setError(t('admin.error', { code: response.code }));
    });
  return (
    <div>
      <h2>{t('admin.release.drafts')}</h2>
      <label>
        <input
          type="checkbox"
          checked={selected.length === drafts.length && drafts.length > 0}
          onChange={(e) => {
            setSelected(e.target.checked ? drafts.map((d) => d.id) : []);
            dirty();
          }}
        />
        {t('admin.release.selectAll')}
      </label>
      {drafts.map((draft) => (
        <label key={draft.id}>
          <input
            type="checkbox"
            checked={selected.includes(draft.id)}
            onChange={(e) => {
              setSelected(
                e.target.checked
                  ? [...selected, draft.id]
                  : selected.filter((id) => id !== draft.id),
              );
              dirty();
            }}
          />
          {t('admin.release.draft', { unitId: draft.unitId, version: draft.version })}
        </label>
      ))}
      {!drafts.length && <p>{t('admin.empty')}</p>}
      <label htmlFor="notes">{t('admin.release.notes')}</label>
      <textarea
        id="notes"
        value={notes}
        maxLength={2000}
        onChange={(e) => {
          setNotes(e.target.value);
        }}
      />
      <label htmlFor="rollback">{t('admin.release.rollback')}</label>
      <select
        id="rollback"
        value={rollback}
        onChange={(e) => {
          setRollback(e.target.value);
          dirty();
        }}
      >
        <option value="">{t('admin.release.new')}</option>
        {releases.map((release) => (
          <option key={release.version} value={release.version}>
            {t('admin.content', { text: release.version })}
          </option>
        ))}
      </select>
      <Button disabled={pending || (!rollback && !selected.length)} onClick={() => perform(true)}>
        {t('admin.release.preflight')}
      </Button>{' '}
      <Button
        disabled={
          pending || !notes.trim() || !result || result.errors.length > 0 || Boolean(result.version)
        }
        onClick={() => perform(false)}
      >
        {t('admin.release.publish')}
      </Button>
      <div aria-live="polite">
        {pending && <p>{t('admin.pending')}</p>}
        {error && <p role="alert">{error}</p>}
        {result && (
          <>
            <p role="status">
              {result.version
                ? t('admin.release.published', { version: result.version })
                : t(result.errors.length ? 'admin.release.failed' : 'admin.release.ready')}
            </p>
            <ul>
              {result.errors.map((error, i) => (
                <li key={i}>
                  {t('admin.ku.diagnostic', {
                    line: error.line,
                    column: error.column,
                    message: error.message,
                  })}
                </li>
              ))}
            </ul>
            <h2>{t('admin.release.coverage')}</h2>
            {result.coverage.map((row) => (
              <p key={row.system}>
                {t('admin.release.coverageResult', {
                  system: row.system,
                  count: row.errors.length,
                })}
                {row.errors.map((text, i) => (
                  <span key={i}>{t('admin.content', { text })}</span>
                ))}
              </p>
            ))}
          </>
        )}
      </div>
      <h2>{t('admin.release.history')}</h2>
      {releases.map((release) => (
        <article key={release.version} className="admin-panel">
          <h3>{t('admin.content', { text: release.version })}</h3>
          <p>{t('admin.content', { text: release.notes ?? '' })}</p>
          <time dateTime={release.createdAt}>
            {t('admin.content', { text: release.createdAt })}
          </time>
        </article>
      ))}
    </div>
  );
}
