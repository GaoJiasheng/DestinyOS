'use client';
import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Link } from '@/i18n/navigation';
import type { ExportRequest } from '@/lib/report-export-schema';
const updateSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  estimatedSeconds: z.number().nonnegative().optional(),
  url: z.string().startsWith('/api/export?').optional(),
  filename: z.string().optional(),
  error: z.string().optional(),
});
/** Responsive export dialog streams progress, shares the cover and downloads one completed artifact. */
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
  const locale = useLocale() as 'zh' | 'en' | 'zh-TW';
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [width, setWidth] = useState<1242 | 1600>(1242);
  const [progress, setProgress] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(25);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [working, setWorking] = useState(false);
  const lastFormat = useRef<ExportRequest['format']>('png');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const generate = async (format: ExportRequest['format']) => {
    setWorking(true);
    lastFormat.current = format;
    setError('');
    setFinished(false);
    setProgress(0);
    setSeconds(25);
    abort.current = new AbortController();
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId, locale, theme, format, width }),
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
      let result: { url: string; filename: string } | undefined;
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        if (done && buffer.trim()) lines.push(buffer);
        for (const line of lines) {
          if (!line.trim()) continue;
          const update = updateSchema.parse(JSON.parse(line));
          if (update.error) {
            setError(t(update.error === 'E_EXPORT_TIMEOUT' ? 'export.timeout' : 'export.failed'));
            return;
          }
          if (update.progress !== undefined) setProgress(update.progress);
          if (update.estimatedSeconds !== undefined) setSeconds(update.estimatedSeconds);
          if (update.url && update.filename)
            result = { url: update.url, filename: update.filename };
        }
        if (done) break;
      }
      if (!result) throw new Error('Incomplete export');
      let shared = false;
      if (format === 'cover' && navigator.canShare && navigator.share) {
        const download = await fetch(result.url, { signal: abort.current.signal });
        if (!download.ok) throw new Error('Download unavailable');
        const file = new File([await download.blob()], result.filename, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: t('export.cover') });
            shared = true;
          } catch (failure) {
            if (failure instanceof DOMException && failure.name === 'AbortError') shared = true;
            // DESIGN-GAP: Browsers that lose user activation during generation fall back to a direct attachment download.
          }
        }
      }
      if (!shared) {
        const link = document.createElement('a');
        link.href = result.url;
        link.download = result.filename;
        document.body.append(link);
        link.click();
        link.remove();
      }
      setFinished(true);
    } catch {
      setError(t('export.failed'));
    } finally {
      setWorking(false);
      setProgress((p) => (p === 100 ? 100 : null));
    }
  };
  const busy = working;
  return (
    <div className="export-menu">
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {t('export.menu')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('export.menu')}
        description={t('export.description')}
        className="export-dialog"
      >
        {local || !owner ? (
          <>
            <p>{t('export.login')}</p>
            <Link className="text-link" href="/auth/login">
              {t('nav.login')}
            </Link>
          </>
        ) : (
          <div className="export-options">
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
            <label className="birth-field">
              {t('export.width')}
              <select
                value={width}
                disabled={busy}
                onChange={(e) => setWidth(e.target.value === '1600' ? 1600 : 1242)}
              >
                <option value="1242">{t('export.widthMobile')}</option>
                <option value="1600">{t('export.widthWide')}</option>
              </select>
            </label>
            <div className="export-primary-actions">
              <Button disabled={busy} onClick={() => void generate('png')}>
                {t('export.png')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void generate('pdf')}>
                {t('export.pdf')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void generate('cover')}>
                {t('export.cover')}
              </Button>
            </div>
          </div>
        )}
        {progress !== null ? (
          <div role="status" aria-live="polite" className="export-status">
            <p>{t('export.progress', { percent: progress })}</p>
            {busy && progress < 100 ? (
              <p className="muted">{t('export.estimate', { seconds })}</p>
            ) : null}
            <progress
              value={progress}
              max="100"
              aria-label={t('export.progress', { percent: progress })}
            />
            {finished ? <p>{t('export.complete')}</p> : null}
          </div>
        ) : null}
        {error ? (
          <div className="export-error">
            <p role="alert">{error}</p>
            <Button variant="ghost" onClick={() => void generate(lastFormat.current)}>
              {t('export.retry')}
            </Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
