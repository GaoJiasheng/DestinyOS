import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, View, Keyboard, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { brand } from '@tianji/shared';
import type { z } from 'zod';
import type { ChatHistorySchema } from '@tianji/api-client';
import { currentOwner, subscribeOwner } from '../../lib/account/scope';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { useOnline } from '../../lib/network';
import { reportActions, reportActionError, type ReportActions } from '../../lib/reports/actions';
import type { MessageKey } from '../../lib/i18n';
import { Page, Action, CopyText, Field } from '../native-ui';
/** Native incremental conversation with quota, cancellation, retry and owner-only history deletion. */
export function ChatScreen({
  id,
  actions = reportActions,
  back,
}: {
  id: string;
  actions?: ReportActions;
  back?: () => void;
}) {
  const t = useCopy(),
    router = useRouter(),
    online = useOnline(),
    locale = usePreferences((s) => s.locale);
  const owner = useSyncExternalStore(subscribeOwner, currentOwner, currentOwner);
  const [history, setHistory] = useState<z.infer<typeof ChatHistorySchema> | null>(null);
  const [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState(''),
    [submitted, setSubmitted] = useState('');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0),
    [error, setError] = useState<MessageKey | null>(null);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (busy) requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
  }, [answer, busy]);
  const abort = useRef<AbortController | null>(null),
    generation = useRef(0);
  useEffect(() => {
    setQuestion('');
  }, [id, locale, owner]);
  useEffect(() => {
    let alive = true;
    const version = ++generation.current;
    abort.current?.abort();
    setBusy(false);
    setAnswer('');
    setSubmitted('');
    setHistory(null);
    if (!online) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void actions
      .history(id)
      .then((value) => {
        if (alive && generation.current === version) setHistory(value);
      })
      .catch((cause: unknown) => {
        if (alive) setError(reportActionError(cause, 'chat'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [id, online, locale, retry, actions, owner]);
  async function send() {
    if (busy || !online || !history?.available || !history.remaining || !question.trim()) return;
    if (question.trim().length > 120) {
      setError('report.chat.tooLong');
      return;
    }
    Keyboard.dismiss();
    const controller = new AbortController();
    abort.current = controller;
    const version = generation.current,
      text = question.trim();
    setBusy(true);
    setError(null);
    setAnswer('');
    setSubmitted(text);
    let complete = '';
    try {
      await actions.send(
        id,
        locale,
        text,
        (delta) => {
          if (version === generation.current && !controller.signal.aborted) {
            complete += delta;
            setAnswer(complete);
          }
        },
        controller.signal,
      );
      if (controller.signal.aborted || version !== generation.current) return;
      setHistory((old) =>
        old
          ? {
              ...old,
              remaining: Math.max(0, old.remaining - 1),
              messages: [
                ...old.messages,
                { id: `${Date.now()}-user`, role: 'user', content: text, createdAt: '' },
                {
                  id: `${Date.now()}-assistant`,
                  role: 'assistant',
                  content: complete,
                  createdAt: '',
                },
              ],
            }
          : old,
      );
      setQuestion('');
      setAnswer('');
      setSubmitted('');
    } catch (cause) {
      if (!controller.signal.aborted && version === generation.current) {
        setError(reportActionError(cause, 'chat'));
        if (reportActionError(cause, 'chat') === 'report.chat.quota')
          setHistory((old) => (old ? { ...old, remaining: 0 } : old));
        setAnswer('');
        setSubmitted('');
      }
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return (
    <Page
      title="report.chat.title"
      scrollRef={scroll}
      footer={
        <>
          <Field
            id="chat-question"
            label={t('report.chat.question')}
            value={question}
            onChange={setQuestion}
            maxLength={121}
          />
          <Action
            id="chat-send"
            label={t('report.chat.send')}
            disabled={
              !online || busy || !history?.available || !history.remaining || !question.trim()
            }
            onPress={() => void send()}
          />
          {busy && (
            <Action
              id="chat-cancel"
              label={t('profiles.cancel')}
              onPress={() => {
                abort.current?.abort();
                generation.current++;
                setBusy(false);
                setAnswer('');
                setSubmitted('');
              }}
            />
          )}
        </>
      }
    >
      <Action
        id="chat-back"
        label={t('report.chat.back')}
        onPress={back ?? (() => router.back())}
      />
      <CopyText>{t('report.chat.privacy')}</CopyText>
      <CopyText testID="chat-ai-notice">{t('mobile.chat.ai')}</CopyText>
      {!online && <CopyText testID="chat-offline">{t('mobile.ask.network')}</CopyText>}
      {loading && <CopyText>{t('report.chat.loading')}</CopyText>}
      {error && <CopyText testID="chat-error">{t(error)}</CopyText>}
      {error === 'report.chat.login' && (
        <Action id="chat-login" label={t('nav.login')} onPress={() => router.push('/auth/login')} />
      )}
      {online && !loading && (
        <Action
          id="chat-retry"
          label={t('common.retry')}
          disabled={busy}
          onPress={() => setRetry((v) => v + 1)}
        />
      )}
      {history && (
        <>
          <CopyText testID="chat-quota">
            {t('report.chat.remaining', { remaining: history.remaining, limit: history.limit })}
          </CopyText>
          {!history.available && <CopyText>{t('report.chat.away')}</CopyText>}
          {!history.remaining && <CopyText>{t('report.chat.quota')}</CopyText>}
          {!history.messages.length && !submitted && <CopyText>{t('report.chat.empty')}</CopyText>}
          {history.messages.map((message) => (
            <View key={message.id} style={{ gap: 8 }}>
              <CopyText title>
                {t(message.role === 'user' ? 'report.chat.you' : 'report.chat.master')}
              </CopyText>
              <CopyText>{t('report.content', { text: message.content })}</CopyText>
            </View>
          ))}
        </>
      )}
      {submitted && <CopyText>{t('report.content', { text: submitted })}</CopyText>}
      {busy && (
        <CopyText testID="chat-stream">
          {answer ? t('report.content', { text: answer }) : t('report.chat.thinking')}
        </CopyText>
      )}
      <Action
        id="chat-report"
        label={t('mobile.chat.report')}
        disabled={!online || busy}
        onPress={() => {
          // DESIGN-GAP: No abuse-report endpoint is specified; use the existing contact channel without automatically attaching private dialogue.
          void openBrowserAsync(`https://${brand.domain}/${locale}/contact`).catch(() =>
            setError('mobile.chat.reportFailed'),
          );
        }}
      />
      <Action
        id="chat-delete"
        label={t('report.chat.delete')}
        disabled={!online || busy || !history?.messages.length}
        onPress={() =>
          Alert.alert(t('report.chat.delete'), t('report.chat.privacy'), [
            { text: t('profiles.cancel'), style: 'cancel' },
            {
              text: t('report.chat.delete'),
              style: 'destructive',
              onPress: () => {
                setLoading(true);
                void actions
                  .deleteChat(id)
                  .then(() => setRetry((v) => v + 1))
                  .catch(() => setError('report.chat.deleteFailed'))
                  .finally(() => setLoading(false));
              },
            },
          ])
        }
      />
    </Page>
  );
}
