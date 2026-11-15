'use client';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import type { System } from '@tianji/shared';
import type { MessageKey } from '@/i18n/catalog';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { LoginLink } from '@/components/auth/login-link';
import { Button } from '@/components/ui/button';
import { Square } from 'lucide-react';
import {
  errorSchema,
  eventSchema,
  historySchema,
  localResetTime,
  type Message,
} from './chat-panel-support';
/** Lazy, collapsible follow-up dialogue; unavailable chat never blocks report rendering. */
export function ChatPanel({
  readingId,
  system,
  owner,
  fullScreen = false,
}: {
  readingId: string;
  system: System;
  owner: boolean;
  fullScreen?: boolean;
}) {
  const t = useCopy(),
    locale = useLocale();
  const [open, setOpen] = useState(fullScreen),
    [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState('');
  const { pending, run } = useSubmitTransition();
  const [working, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [available, setAvailable] = useState(false);
  const busy = working || pending;
  const [remaining, setRemaining] = useState(0),
    [limit, setLimit] = useState(0),
    [error, setError] = useState(''),
    [stopped, setStopped] = useState(false),
    [confirmClear, setConfirmClear] = useState(false),
    [resetTime, setResetTime] = useState(''),
    // History failures: an expired session needs sign-in, anything else can simply be retried.
    [historyError, setHistoryError] = useState<'login' | 'retry' | null>(null),
    [historyAttempt, setHistoryAttempt] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const hintId = useId();
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const restoreComposerAfterCommit = useRef<Element | null>(null);
  const url = `/api/v1/readings/${encodeURIComponent(readingId)}/chat`;
  const errorCopy = (code: string) =>
    t(
      code === 'E_QUOTA_EXCEEDED'
        ? 'report.chat.quota'
        : code === 'E_RATE_LIMITED'
          ? 'report.chat.rateLimited'
          : code === 'E_INVALID_INPUT' || code === 'E_VALIDATION'
            ? 'report.chat.tooLong'
            : code === 'E_UNAUTHORIZED'
              ? 'report.chat.login'
              : code === 'E_FORBIDDEN'
                ? 'report.chat.forbidden'
                : 'report.chat.away',
      { time: localResetTime(locale) },
    );
  useEffect(() => {
    if (!open || !owner || busy) return;
    const controller = new AbortController();
    setLoading(true);
    setHistoryError(null);
    void fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          setHistoryError('login');
          return;
        }
        const body: unknown = await response.json();
        const parsed = historySchema.safeParse(body);
        if (!parsed.success) throw new Error('Chat unavailable');
        setMessages(parsed.data.data.messages);
        setRemaining(parsed.data.data.remaining);
        setLimit(parsed.data.data.limit);
        setAvailable(parsed.data.data.available);
        setResetTime(localResetTime(locale));
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistoryError('retry');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, owner, url, locale, historyAttempt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (busy) end.current?.scrollIntoView({ block: 'nearest' });
  }, [answer, busy]);
  useEffect(() => {
    if (busy) return;
    const submittedFrom = restoreComposerAfterCommit.current;
    restoreComposerAfterCommit.current = null;
    // DESIGN-GAP: Restore focus after React enables the composer; an animation frame can precede that commit.
    if (
      submittedFrom &&
      (document.activeElement === document.body || document.activeElement === submittedFrom)
    )
      composer.current?.focus();
  }, [busy]);
  const send = async () => {
    if (busy || !question.trim()) return;
    const submittedFrom = document.activeElement;
    const restoreComposer = composer.current?.form?.contains(submittedFrom) ?? false;
    const submitted = question.trim();
    if (submitted.length > 120) {
      setError(t('report.chat.tooLong'));
      return;
    }
    setBusy(true);
    setError('');
    setStopped(false);
    setAnswer('');
    const controller = new AbortController();
    abort.current = controller;
    let text = '',
      done = false;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, question: submitted }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        const parsed = errorSchema.safeParse(body);
        if (parsed.success && parsed.data.error.code === 'E_QUOTA_EXCEEDED') {
          setRemaining(0);
          setResetTime(localResetTime(locale));
        }
        setError(errorCopy(parsed.success ? parsed.data.error.code : 'E_INTERNAL'));
        return;
      }
      if (!response.body) throw new Error('Missing stream');
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let index: number;
          while ((index = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, index);
            buffer = buffer.slice(index + 1);
            if (!line) continue;
            const event = eventSchema.parse(JSON.parse(line));
            if (event.type === 'delta') {
              text += event.text;
              setAnswer(text);
            } else if (event.type === 'done') done = true;
            else throw new Error('Chat failed');
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      if (!done) throw new Error('Incomplete chat');
      setMessages((old) => [
        ...old,
        { id: crypto.randomUUID(), role: 'user', content: submitted },
        { id: crypto.randomUUID(), role: 'assistant', content: text },
      ]);
      setQuestion('');
      setAnswer('');
      setRemaining((value) => Math.max(0, value - 1));
    } catch {
      setAnswer('');
      if (controller.signal.aborted) {
        // A stopped answer is not saved and the server returns its quota, so keep the count;
        // what already streamed stays visible on this page only.
        if (text)
          setMessages((old) => [
            ...old,
            { id: crypto.randomUUID(), role: 'user', content: submitted },
            { id: crypto.randomUUID(), role: 'assistant', content: text },
          ]);
        setQuestion('');
        setStopped(true);
      } else setError(t('report.chat.away'));
    } finally {
      restoreComposerAfterCommit.current = restoreComposer ? submittedFrom : null;
      setBusy(false);
      abort.current = null;
    }
  };
  const clear = async () => {
    setConfirmClear(false);
    setBusy(true);
    setError('');
    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setMessages([]);
      setAnswer('');
    } catch {
      setError(t('report.chat.deleteFailed'));
    } finally {
      setBusy(false);
    }
  };
  // DESIGN-GAP: A scrollable conversation log joins the Tab order so PageDown/arrow keys can read retained messages.
  const body = (
    <div className="chat-body">
      <p className="muted">{t('report.chat.privacy')}</p>
      {!owner ? (
        <LoginLink className="text-link">{t('report.chat.login')}</LoginLink>
      ) : loading ? (
        <p role="status">{t('report.chat.loading')}</p>
      ) : historyError === 'login' ? (
        <p role="alert">
          {t('report.chat.sessionExpired')}{' '}
          <LoginLink className="text-link">{t('report.chat.login')}</LoginLink>
        </p>
      ) : historyError ? (
        <div role="alert">
          <p>{t('report.chat.historyFailed')}</p>
          <Button variant="secondary" onClick={() => setHistoryAttempt((value) => value + 1)}>
            {t('report.chat.retry')}
          </Button>
        </div>
      ) : (
        <>
          {!available ? (
            <p role="status">{t('report.chat.away')}</p>
          ) : (
            <p>{t('report.chat.remaining', { remaining, limit, time: resetTime })}</p>
          )}
          {messages.length === 0 ? <p className="muted">{t('report.chat.empty')}</p> : null}
          <div
            className="chat-history"
            role="log"
            tabIndex={0}
            aria-label={t('report.chat.history')}
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((message) => (
              <div key={message.id} className={`chat-message chat-${message.role}`}>
                <strong>
                  {t(message.role === 'user' ? 'report.chat.you' : 'report.chat.master')}
                </strong>
                <p>{t('report.content', { text: message.content })}</p>
              </div>
            ))}
            {answer ? (
              <div className="chat-message chat-assistant">
                <strong>{t('report.chat.master')}</strong>
                <p>{t('report.content', { text: answer })}</p>
              </div>
            ) : null}
            <div ref={end} />
          </div>
          {available ? (
            <>
              <div className="chat-chips" aria-label={t('report.chat.suggestions')}>
                {Array.from({ length: 6 }, (_, i) => (
                  <Button
                    variant="secondary"
                    key={i}
                    disabled={busy || remaining === 0}
                    onClick={() => setQuestion(t(`report.chat.chips.${system}.${i}` as MessageKey))}
                  >
                    {t(`report.chat.chips.${system}.${i}` as MessageKey)}
                  </Button>
                ))}
              </div>
              {remaining === 0 ? (
                <p role="status">{t('report.chat.quota', { time: resetTime })}</p>
              ) : null}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  run(send);
                }}
              >
                <label className="birth-field">
                  {t('report.chat.question')}
                  <textarea
                    ref={composer}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      // Enter sends, Shift+Enter breaks the line; IME composition keeps Enter for the candidate list.
                      if (
                        event.key !== 'Enter' ||
                        event.shiftKey ||
                        event.nativeEvent.isComposing ||
                        event.keyCode === 229
                      )
                        return;
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }}
                    aria-describedby={hintId}
                    maxLength={120}
                    rows={3}
                    disabled={busy || remaining === 0}
                  />
                </label>
                <p id={hintId} className="muted">
                  {t('report.chat.enterHint')}
                </p>
                <div className="action-row">
                  <Button disabled={busy || remaining === 0 || !question.trim()}>
                    {t(busy ? 'report.chat.thinking' : 'report.chat.send')}
                  </Button>
                  {pending ? (
                    // A plain button: the shared Button reads form status and would disable itself mid-send.
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => abort.current?.abort()}
                    >
                      <Square aria-hidden="true" size={14} />
                      {t('report.chat.stop')}
                    </button>
                  ) : null}
                </div>
              </form>
            </>
          ) : null}
          {stopped ? <p role="status">{t('report.chat.stopped')}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {messages.length && !confirmClear ? (
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmClear(true)}>
              {t('report.chat.delete')}
            </Button>
          ) : null}
          {messages.length && confirmClear ? (
            <div className="chat-confirm" role="group" aria-label={t('report.chat.delete')}>
              <p>{t('report.chat.deleteConfirm')}</p>
              <div className="action-row">
                <Button variant="secondary" onClick={() => setConfirmClear(false)}>
                  {t('report.cancel')}
                </Button>
                <Button disabled={busy} action={clear}>
                  {t('report.confirm')}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
      <p className="legal-body">{t('report.disclaimer.short')}</p>
    </div>
  );
  const link = owner ? (
    <Link className="text-link" href={`/${system}/r/${readingId}${fullScreen ? '' : '/chat'}`}>
      {t(fullScreen ? 'report.chat.back' : 'report.chat.fullScreen')}
    </Link>
  ) : null;
  return fullScreen ? (
    <section className="report-card chat-panel chat-fullscreen">
      <h1 className="type-h1">{t('report.chat.title')}</h1>
      {link}
      {body}
    </section>
  ) : (
    <details
      id="report-chat"
      className="report-card chat-panel"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t('report.chat.title')}</summary>
      {open ? (
        <>
          {link}
          {body}
        </>
      ) : null}
    </details>
  );
}
