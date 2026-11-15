'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import type { MessageKey } from '@/i18n/catalog';
import {
  listShareLinksAction,
  revokeAllShareLinksAction,
  revokeShareLinkAction,
} from '@/app/share/actions';
/** Report notices ask the share dialog to open through this window event. */
export const SHARE_OPEN_EVENT = 'tianji:share-open';
/** The dialog tells report notices whether any public link is still live. */
export const SHARE_PUBLIC_EVENT = 'tianji:share-public';
export type SharePublicDetail = { readingId: string; isPublic: boolean };
export function announcePublic(readingId: string, isPublic: boolean) {
  window.dispatchEvent(
    new CustomEvent<SharePublicDetail>(SHARE_PUBLIC_EVENT, { detail: { readingId, isPublic } }),
  );
}
type Live = Extract<Awaited<ReturnType<typeof listShareLinksAction>>, { ok: true }>['data'];
/** Every live link of one reading, so links stay findable and revocable after the dialog closes. */
export function ShareLinks({
  readingId,
  refresh,
  onRevoked,
}: {
  readingId: string;
  refresh: number;
  /** A revoked token, or 'all'. */
  onRevoked: (token: string) => void;
}) {
  const t = useCopy(),
    locale = useLocale();
  const [links, setLinks] = useState<Live | null>(null),
    [reload, setReload] = useState(0),
    [error, setError] = useState<'' | 'load' | 'action'>(''),
    [notice, setNotice] = useState<'' | 'copied' | 'revoked' | 'revokedAll'>('');
  useEffect(() => {
    let active = true;
    void listShareLinksAction(readingId)
      .then((r) => {
        if (!active) return;
        if (r.ok) {
          setLinks(r.data);
          setError('');
        } else setError('load');
      })
      .catch(() => {
        if (active) setError('load');
      });
    return () => {
      active = false;
    };
  }, [readingId, refresh, reload]);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  const url = (token: string) => `${window.location.origin}/s/${token}?locale=${locale}`;
  return (
    <section className="share-links" aria-labelledby="share-links-title">
      <h3 id="share-links-title" className="type-h3">
        {t('report.shareLinks.title')}
      </h3>
      {links && !links.length ? <p className="muted">{t('report.shareLinks.empty')}</p> : null}
      {links?.length ? (
        <ul className="share-link-list">
          {links.map((link) => (
            <li key={link.token}>
              <p>
                {t('report.shareLinks.item', {
                  template: t(`share.template.${link.template}` as MessageKey),
                  level: link.revealLevel,
                })}
              </p>
              <p className="muted">
                {t('report.shareLinks.created', { date: date(link.createdAt) })}
                {' · '}
                {link.expiresAt
                  ? t('report.shareLinks.expiresOn', { date: date(link.expiresAt) })
                  : t('report.shareLinks.never')}
              </p>
              <div className="action-row">
                <Button
                  variant="ghost"
                  action={async () => {
                    await navigator.clipboard
                      .writeText(url(link.token))
                      .then(() => setNotice('copied'))
                      .catch(() => setError('action'));
                  }}
                >
                  {t('share.copy')}
                </Button>
                <Button
                  variant="ghost"
                  action={async () => {
                    await revokeShareLinkAction(link.token)
                      .then((r) => {
                        if (!r.ok) return setError('action');
                        setNotice('revoked');
                        onRevoked(link.token);
                        announcePublic(readingId, r.data.isPublic);
                        setReload((n) => n + 1);
                      })
                      .catch(() => setError('action'));
                  }}
                >
                  {t('share.revoke')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {links && links.length > 1 ? (
        <Button
          variant="secondary"
          action={async () => {
            await revokeAllShareLinksAction(readingId)
              .then((r) => {
                if (!r.ok) return setError('action');
                setNotice('revokedAll');
                onRevoked('all');
                announcePublic(readingId, false);
                setReload((n) => n + 1);
              })
              .catch(() => setError('action'));
          }}
        >
          {t('report.shareLinks.revokeAll')}
        </Button>
      ) : null}
      {notice ? (
        <p role="status">
          {t(
            notice === 'copied'
              ? 'share.copied'
              : notice === 'revoked'
                ? 'report.shareRevoked'
                : 'report.shareLinks.revokedAll',
          )}
        </p>
      ) : null}
      {error ? (
        <p role="alert">
          {t(error === 'load' ? 'report.shareLinks.loadFailed' : 'report.error.E_INTERNAL')}
        </p>
      ) : null}
    </section>
  );
}
