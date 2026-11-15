'use client';
import { useRef, useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PrivacyChoices } from '@/components/ads/privacy-choices';
import { isQuotaError } from '@/lib/anonymous-encoding';
type Status =
  | { kind: 'imported'; count: number }
  | {
      kind: 'error';
      key:
        | 'report.error.E_INTERNAL'
        | 'me.importError.E_IMPORT_JSON'
        | 'me.importError.E_IMPORT_SHAPE'
        | 'me.importError.E_IMPORT_EMPTY'
        | 'me.importError.E_IMPORT_STORAGE';
    };
/** "My data": export for everyone, device import for anonymous visitors, privacy links and build version. */
export function SettingsData({
  signedIn,
  version,
}: {
  signedIn: boolean;
  version?: string | null;
}) {
  const t = useCopy(),
    file = useRef<HTMLInputElement>(null),
    [status, setStatus] = useState<Status | null>(null);
  async function download() {
    setStatus(null);
    try {
      const blob = signedIn
        ? await fetch('/api/v1/me/export').then(async (r) => {
            if (!r.ok) throw new Error('Export failed');
            return r.blob();
          })
        : await import('@/lib/anonymous-storage').then(
            async ({ readAnonymous }) =>
              new Blob([JSON.stringify({ ok: true, data: await readAnonymous() }, null, 2)], {
                type: 'application/json',
              }),
          );
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = 'tianji-export.json';
      document.body.append(a);
      a.click();
      a.remove();
      // Safari starts the download asynchronously; revoking at once can cancel it.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setStatus({ kind: 'error', key: 'report.error.E_INTERNAL' });
    }
  }
  async function importFile(chosen: File) {
    setStatus(null);
    try {
      const [{ parseAnonymousExport, mergeAnonymous }, { updateAnonymous }] = await Promise.all([
        import('@/lib/anonymous-import'),
        import('@/lib/anonymous-storage'),
      ]);
      const parsed = parseAnonymousExport(await chosen.text());
      if (!parsed.ok) {
        setStatus({ kind: 'error', key: `me.importError.${parsed.error}` });
        return;
      }
      let count = 0;
      await updateAnonymous((current) => {
        const merged = mergeAnonymous(current, parsed.data);
        count = merged.added;
        return merged.data;
      });
      setStatus({ kind: 'imported', count });
    } catch (error) {
      setStatus({
        kind: 'error',
        key: isQuotaError(error) ? 'me.importError.E_IMPORT_STORAGE' : 'report.error.E_INTERNAL',
      });
    }
  }
  return (
    <section className="report-card settings-data">
      <h2>{t('me.data')}</h2>
      <div className="action-row">
        <Button variant="secondary" action={download}>
          {t('me.export')}
        </Button>
        {/* DESIGN-GAP: Account data has no import endpoint; only the anonymous device snapshot can be restored. */}
        {!signedIn ? (
          <>
            <Button variant="secondary" onClick={() => file.current?.click()}>
              {t('me.import')}
            </Button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label={t('me.import')}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                e.target.value = '';
                if (chosen) void importFile(chosen);
              }}
            />
          </>
        ) : null}
      </div>
      {!signedIn ? <p className="muted">{t('me.importHelp')}</p> : null}
      {status ? (
        <p role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.kind === 'error' ? t(status.key) : t('me.imported', { count: status.count })}
        </p>
      ) : null}
      <ul className="settings-links">
        <li>
          <PrivacyChoices settings />
        </li>
        <li>
          <Link href="/privacy">{t('me.privacy')}</Link>
        </li>
      </ul>
      {version ? <p className="muted">{t('me.version', { version })}</p> : null}
    </section>
  );
}
