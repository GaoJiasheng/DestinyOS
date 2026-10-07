import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { projectShare, type ShareTemplate } from '@tianji/ui-core/share-projection';
import { useCopy } from '../../lib/copy';
import { useOnline } from '../../lib/network';
import { useAccount } from '../../lib/account/controller';
import { usePreferences } from '../../lib/preferences';
import {
  reportActions,
  shareExport,
  shareLink,
  reportActionError,
  type ReportActions as Operations,
} from '../../lib/reports/actions';
import type { NativeReading } from '../../lib/reports/readings';
import type { MessageKey } from '../../lib/i18n';
import { Action, CopyText } from '../native-ui';
import { ReportSheet } from './report-ui';
import { ShareCard } from './share-card';
/** Report follow-up, Web-rendered A4 downloads and offline Skia cards with explicit visibility choice. */
export function ReportActions({
  reading,
  actions = reportActions,
  chat,
  diagnostic = false,
}: {
  reading: NativeReading;
  actions?: Operations;
  chat?: () => void;
  diagnostic?: boolean;
}) {
  const t = useCopy(),
    router = useRouter(),
    online = useOnline(),
    locale = usePreferences((s) => s.locale);
  const session = useAccount((s) => s.session);
  const enabled = Boolean(session || (__DEV__ && diagnostic));
  const [panel, setPanel] = useState<'export' | 'share' | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<MessageKey | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark'),
    [files, setFiles] = useState<{ url: string; filename: string }[]>([]);
  const [level, setLevel] = useState(0),
    [template, setTemplate] = useState<ShareTemplate>(
      reading.chart.system === 'synastry' ? 'synastry' : 'quote',
    ),
    [url, setUrl] = useState('');
  const projection = useRef<ReturnType<typeof projectShare> | null>(null);
  const key = `${reading.record.id}-${locale}-${level}-${template}`;
  const projectionKey = useRef('');
  if (projectionKey.current !== key) {
    projection.current = projectShare(
      reading.chart.system,
      reading.chart.data,
      reading.report,
      template,
      level,
    );
    projectionKey.current = key;
  }
  useEffect(() => {
    setFiles([]);
    setUrl('');
  }, [locale, reading.record.id]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(mode: 'export' | 'share', operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      if (alive.current) setError(reportActionError(cause, mode));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <Action
        id="report-chat"
        label={t('report.chat.title')}
        disabled={!online}
        onPress={
          chat ??
          (() => router.push({ pathname: '/r/[id]/chat', params: { id: reading.record.id } }))
        }
      />
      {!online && <CopyText testID="report-network">{t('mobile.ask.network')}</CopyText>}
      <Action
        id="report-export"
        label={t('export.menu')}
        disabled={!online}
        onPress={() => {
          setPanel('export');
          setError(null);
        }}
      />
      <Action
        id="report-share"
        label={t('share.preview')}
        onPress={() => {
          setPanel('share');
          setError(null);
        }}
      />
      {panel && (
        <ReportSheet
          id={`report-${panel}-panel`}
          title={t(panel === 'export' ? 'export.menu' : 'share.preview')}
          close={() => {
            if (!busy) setPanel(null);
          }}
        >
          {error && <CopyText testID="report-action-error">{t(error)}</CopyText>}
          {busy && <CopyText testID="report-action-busy">{t('common.loading')}</CopyText>}
          {!online && <CopyText>{t('mobile.ask.network')}</CopyText>}
          {!enabled && (
            <Action
              label={t('export.login')}
              onPress={() => {
                setPanel(null);
                router.push('/auth/login');
              }}
            />
          )}
          {panel === 'export' ? (
            <>
              <CopyText>{t('export.theme')}</CopyText>
              {(['dark', 'light'] as const).map((item) => (
                <Action
                  key={item}
                  id={`export-theme-${item}`}
                  label={t(`export.${item}`)}
                  selected={theme === item}
                  disabled={busy}
                  onPress={() => {
                    setTheme(item);
                    setFiles([]);
                  }}
                />
              ))}
              {(['pdf', 'png', 'cover'] as const).map((format) => (
                <Action
                  key={format}
                  id={`export-${format}`}
                  label={t(`export.${format}`)}
                  disabled={!online || !enabled || busy}
                  onPress={() =>
                    void run('export', async () => {
                      const result = await actions.export(reading.record.id, {
                        locale,
                        theme,
                        format,
                      });
                      if (!alive.current) return;
                      setFiles(result);
                      await shareExport(actions, result[0]!, t('export.download'));
                    })
                  }
                />
              ))}
              {files.map((file, i) => (
                <Action
                  key={file.url}
                  id={`export-page-${i}`}
                  label={t('export.pageDownload', { number: i + 1 })}
                  disabled={!online || busy}
                  onPress={() =>
                    void run('export', () => shareExport(actions, file, t('export.download')))
                  }
                />
              ))}
            </>
          ) : (
            <>
              <CopyText>{t('share.help')}</CopyText>
              {(reading.chart.system === 'synastry'
                ? (['synastry', 'quote'] as const)
                : (['chart', 'quote'] as const)
              ).map((item) => (
                <Action
                  key={item}
                  id={`share-template-${item}`}
                  label={t(`share.template.${item}`)}
                  selected={template === item}
                  disabled={busy}
                  onPress={() => {
                    setTemplate(item);
                    setUrl('');
                  }}
                />
              ))}
              {[0, 1, 2].map((item) => (
                <Action
                  key={item}
                  id={`share-level-${item}`}
                  label={t(`share.reveal.${item}` as MessageKey)}
                  selected={level === item}
                  disabled={busy}
                  onPress={() => {
                    setLevel(item);
                    setUrl('');
                  }}
                />
              ))}
              {projection.current && <ShareCard value={projection.current} />}
              <Action
                id="share-link"
                label={t('share.copy')}
                disabled={!online || !enabled || busy}
                onPress={() =>
                  void run('share', async () => {
                    const link = await actions.link(reading.record.id, {
                      locale,
                      template,
                      revealLevel: level,
                    });
                    if (alive.current) setUrl(link);
                    await Clipboard.setStringAsync(link);
                  })
                }
              />
              {url && (
                <>
                  <CopyText testID="share-link-url">{t('report.content', { text: url })}</CopyText>
                  <Action
                    id="share-link-native"
                    label={t('share.native')}
                    onPress={() => void run('share', () => shareLink(url))}
                  />
                </>
              )}
            </>
          )}
        </ReportSheet>
      )}
    </>
  );
}
