'use client';
import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/share/share-dialog';
import { Link } from '@/i18n/navigation';
import type { ExportRequest } from '@/lib/report-export-schema';
const updateSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  url: z.string().startsWith('/api/export?').optional(),
  filename: z.string().optional(),
  error: z.string().optional(),
  files: z
    .array(z.object({ url: z.string().startsWith('/api/export?'), filename: z.string() }))
    .max(80)
    .optional(),
});
/** Accessible export chooser reports real streamed stages and retains a retry/download state. */
export function ExportMenu({
  readingId,
  local,
  owner,
}: {
  readingId: string;
  local: boolean;
  owner: boolean;
}) {
  const t = useCopy();
  const locale = useLocale() as 'zh' | 'en';
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [progress, setProgress] = useState<number | null>(null);
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<{ url: string; filename: string }[]>([]);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const generate = async (format: ExportRequest['format']) => {
    setError('');
    setUrl('');
    setFiles([]);
    setProgress(0);
    abort.current = new AbortController();
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId, locale, theme, format }),
        signal: abort.current.signal,
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? t('export.login')
            : response.status === 403
              ? t('export.membership')
              : response.status === 429
                ? t('export.rateLimit')
                : t('export.failed'),
        );
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Missing stream');
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const update = updateSchema.parse(JSON.parse(line));
          if (update.error) throw new Error('Export failed');
          if (update.progress !== undefined) setProgress(update.progress);
          if (update.url) setUrl(update.url);
          if (update.files) setFiles(update.files);
        }
        if (done) break;
      }
    } catch {
      setError(t('export.failed'));
    } finally {
      setProgress((p) => (p === 100 ? 100 : null));
    }
  };
  const busy = progress !== null && progress < 100;
  return (
    <details className="report-more export-menu">
      <summary>{t('export.menu')}</summary>
      <div className="report-more-actions">
        {local || !owner ? (
          <>
            <p>{t('export.login')}</p>
            <Link className="text-link" href="/auth/login">
              {t('nav.login')}
            </Link>
          </>
        ) : (
          <>
            <label className="birth-field">
              {t('export.theme')}
              <select
                value={theme}
                disabled={busy}
                onChange={(e) => setTheme(e.target.value === 'light' ? 'light' : 'dark')}
              >
                <option value="dark">{t('export.dark')}</option>
                <option value="light">{t('export.light')}</option>
              </select>
            </label>
            <Button variant="ghost" disabled={busy} onClick={() => void generate('pdf')}>
              {t('export.pdf')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void generate('png')}>
              {t('export.png')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void generate('cover')}>
              {t('export.cover')}
            </Button>
          </>
        )}
        <ShareDialog readingId={readingId} local={local} />
        {progress !== null ? (
          <div role="status" aria-live="polite">
            <p>{t('export.progress', { percent: progress })}</p>
            <progress
              value={progress}
              max="100"
              aria-label={t('export.progress', { percent: progress })}
            />
          </div>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        {files.length ? (
          <ol>
            {files.map((file, index) => (
              <li key={file.url}>
                <a className="text-link" href={file.url} download>
                  {t('export.pageDownload', { number: index + 1 })}
                </a>
              </li>
            ))}
          </ol>
        ) : url ? (
          <a className="text-link" href={url} download>
            {t('export.download')}
          </a>
        ) : null}
      </div>
    </details>
  );
}
