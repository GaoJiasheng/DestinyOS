'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { Share2 } from 'lucide-react';
import type { MessageKey } from '@/i18n/catalog';
import {
  createShareLinkAction,
  signDailyCardAction,
  revokeShareLinkAction,
} from '@/app/share/actions';
import type { DailyCard, ShareTemplate } from '@/lib/share-projection';
const errorKey: Record<'create' | 'preview' | 'action', MessageKey> = {
  create: 'report.shareCreateFailed',
  preview: 'report.sharePreviewFailed',
  action: 'report.error.E_INTERNAL',
};
/** Accessible template/privacy picker with PNG preview, download, link copy and native sharing. */
export function ShareDialog({
  readingId,
  daily,
  local = false,
  system,
  toolbar = false,
}: {
  readingId?: string;
  daily?: DailyCard;
  local?: boolean;
  system?: string;
  /** Render the trigger as an outlined icon button for the report toolbar. */
  toolbar?: boolean;
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
    // Creating the link and rendering its preview fail independently; the link stays usable either way.
    [error, setError] = useState<'' | 'create' | 'preview' | 'action'>(''),
    [notice, setNotice] = useState<'' | 'copied' | 'revoked'>(''),
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
        if (active) setError('preview');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);
  async function generate() {
    setBusy(true);
    setError('');
    setNotice('');
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
      setError('create');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant={toolbar ? 'secondary' : 'ghost'}
        className={toolbar ? 'report-action' : undefined}
        onClick={() => {
          if (daily)
            window.dispatchEvent(
              new CustomEvent('tianji:event', { detail: { name: 'daily.share' } }),
            );
          setOpen(true);
        }}
      >
        {toolbar ? <Share2 aria-hidden="true" size={16} /> : null}
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
            <Button disabled={busy} action={generate}>
              {t('share.generate')}
            </Button>
            {preview ? (
              <img className="share-preview" src={preview} alt={t('share.preview')} />
            ) : null}
            {url ? (
              <>
                <input
                  className="share-link"
                  readOnly
                  value={url}
                  aria-label={t('report.shareLink')}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="action-row">
                  {preview ? (
                    <a className="text-link" download="tianji.png" href={preview}>
                      {t('share.download')}
                    </a>
                  ) : null}
                  <Button
                    variant="ghost"
                    action={async () => {
                      await navigator.clipboard
                        .writeText(url)
                        .then(() => setNotice('copied'))
                        .catch(() => setError('action'));
                    }}
                  >
                    {t('share.copy')}
                  </Button>
                  <Button
                    variant="ghost"
                    action={async () => {
                      try {
                        const blob = preview ? await (await fetch(preview)).blob() : null,
                          file = blob
                            ? new File([blob], 'tianji.png', { type: 'image/png' })
                            : null;
                        if (file && navigator.canShare?.({ files: [file] }))
                          await navigator.share({ files: [file], title: t('report.share') });
                        else if (navigator.share) await navigator.share({ url });
                        else await navigator.clipboard.writeText(url);
                      } catch (e) {
                        if (!(e instanceof DOMException && e.name === 'AbortError'))
                          setError('action');
                      }
                    }}
                  >
                    {t('share.native')}
                  </Button>
                  {token ? (
                    <Button
                      variant="ghost"
                      action={async () => {
                        await revokeShareLinkAction(token)
                          .then((r) => {
                            if (r.ok) {
                              setUrl('');
                              setImage('');
                              setToken('');
                              setError('');
                              setNotice('revoked');
                            } else setError('action');
                          })
                          .catch(() => setError('action'));
                      }}
                    >
                      {t('share.revoke')}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
            {notice ? (
              <p role="status">{t(notice === 'copied' ? 'share.copied' : 'report.shareRevoked')}</p>
            ) : null}
            {error ? <p role="alert">{t(errorKey[error])}</p> : null}
          </>
        )}
      </Dialog>
    </>
  );
}
