'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import {
  createShareLinkAction,
  signDailyCardAction,
  revokeShareLinkAction,
} from '@/app/share/actions';
import type { DailyCard, ShareTemplate } from '@/lib/share-projection';
/** Accessible template/privacy picker with PNG preview, download, link copy and native sharing. */
export function ShareDialog({
  readingId,
  daily,
  local = false,
  system,
}: {
  readingId?: string;
  daily?: DailyCard;
  local?: boolean;
  system?: string;
}) {
  const t = useCopy(),
    locale = useLocale();
  const [open, setOpen] = useState(false),
    [template, setTemplate] = useState<ShareTemplate>(
      daily ? 'daily' : system === 'synastry' ? 'synastry' : 'chart',
    ),
    [level, setLevel] = useState(0),
    [expiresIn, setExpiresIn] = useState<7 | 30 | undefined>(undefined),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(''),
    [image, setImage] = useState(''),
    [preview, setPreview] = useState(''),
    [error, setError] = useState(false),
    [copied, setCopied] = useState(false),
    [token, setToken] = useState('');
  useEffect(() => {
    if (!image) {
      setPreview('');
      return;
    }
    let active = true;
    let objectUrl = '';
    void fetch(image)
      .then((r) => {
        if (!r.ok) throw new Error('Image failed');
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreview(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);
  async function generate() {
    setBusy(true);
    setError(false);
    setCopied(false);
    try {
      const result = daily
        ? await signDailyCardAction(daily)
        : await createShareLinkAction({ readingId, template, revealLevel: level, expiresIn });
      if (!result.ok) throw new Error(result.error.code);
      if ('token' in result.data && typeof result.data.token === 'string') {
        setToken(result.data.token);
        // DESIGN-GAP: ShareLink has no locale column; optional locale queries retain the active UI language in links and images.
        setUrl(`${window.location.origin}/s/${result.data.token}?locale=${locale}`);
        setImage(`/api/v1/og/share/${result.data.token}?format=landscape&locale=${locale}`);
      } else {
        setImage(result.data.url);
        setUrl(new URL(result.data.url, window.location.origin).toString());
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          if (daily)
            window.dispatchEvent(
              new CustomEvent('tianji:event', { detail: { name: 'daily.share' } }),
            );
          setOpen(true);
        }}
      >
        {t('report.share')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('report.share')}
        description={t('share.help')}
      >
        {local && !daily ? (
          <Link href="/auth/login">{t('share.login')}</Link>
        ) : (
          <>
            {!daily ? (
              <>
                <label>
                  {t('share.template')}
                  <select
                    aria-label={t('share.template')}
                    value={template}
                    onChange={(e) => {
                      setTemplate(e.target.value as ShareTemplate);
                      setImage('');
                      setUrl('');
                    }}
                  >
                    {(
                      [
                        'chart',
                        'quote',
                        'daily',
                        ...(system === 'synastry' ? ['synastry' as const] : []),
                      ] as const
                    ).map((k) => (
                      <option key={k} value={k}>
                        {t(`share.template.${k}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('share.reveal')}
                  <select
                    aria-label={t('share.reveal')}
                    value={level}
                    onChange={(e) => {
                      setLevel(Number(e.target.value));
                      setImage('');
                      setUrl('');
                    }}
                  >
                    {([0, 1, 2] as const).map((n) => (
                      <option key={n} value={n}>
                        {t(`share.reveal.${n}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('share.expires')}
                  <select
                    aria-label={t('share.expires')}
                    value={expiresIn ?? ''}
                    onChange={(e) => {
                      setExpiresIn(
                        e.target.value === '7' ? 7 : e.target.value === '30' ? 30 : undefined,
                      );
                      setImage('');
                      setUrl('');
                    }}
                  >
                    <option value="">{t('share.expires.never')}</option>
                    <option value="7">{t('share.expires.7')}</option>
                    <option value="30">{t('share.expires.30')}</option>
                  </select>
                </label>
              </>
            ) : (
              <p>{t('share.reveal.0')}</p>
            )}
            <Button disabled={busy} onClick={() => void generate()}>
              {t('share.generate')}
            </Button>
            {preview ? (
              <img className="share-preview" src={preview} alt={t('share.preview')} />
            ) : null}
            {preview ? (
              <div className="action-row">
                <a className="text-link" download="tianji.png" href={preview}>
                  {t('share.download')}
                </a>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(url)
                      .then(() => setCopied(true))
                      .catch(() => setError(true));
                  }}
                >
                  {t('share.copy')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void (async () => {
                      try {
                        const blob = await (await fetch(preview)).blob(),
                          file = new File([blob], 'tianji.png', { type: 'image/png' });
                        if (navigator.canShare?.({ files: [file] }))
                          await navigator.share({ files: [file], title: t('report.share') });
                        else if (navigator.share) await navigator.share({ url });
                        else await navigator.clipboard.writeText(url);
                      } catch (e) {
                        if (!(e instanceof DOMException && e.name === 'AbortError')) setError(true);
                      }
                    })();
                  }}
                >
                  {t('share.native')}
                </Button>
                {token ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void revokeShareLinkAction(token).then((r) => {
                        if (r.ok) {
                          setUrl('');
                          setImage('');
                          setToken('');
                        } else setError(true);
                      });
                    }}
                  >
                    {t('share.revoke')}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {copied ? <p role="status">{t('share.copied')}</p> : null}
            {error ? <p role="alert">{t('report.error.E_INTERNAL')}</p> : null}
          </>
        )}
      </Dialog>
    </>
  );
}
