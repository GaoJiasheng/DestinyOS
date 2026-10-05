'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import type { System } from '@tianji/shared';
import type { MessageKey } from '@/i18n/catalog';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
const historySchema = z.object({
  ok: z.literal(true),
  data: z.object({
    available: z.boolean(),
    remaining: z.number(),
    limit: z.number(),
    messages: z.array(
      z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        createdAt: z.string(),
      }),
    ),
  }),
});
const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), code: z.string() }),
]);
const errorSchema = z.object({ error: z.object({ code: z.string() }) });
type Message = { id: string; role: 'user' | 'assistant'; content: string };
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
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [available, setAvailable] = useState(false);
  const [remaining, setRemaining] = useState(0),
    [limit, setLimit] = useState(0),
    [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
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
    );
  useEffect(() => {
    if (!open || !owner || busy) return;
    const controller = new AbortController();
    setLoading(true);
    void fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body: unknown = await response.json();
        const parsed = historySchema.safeParse(body);
        if (!parsed.success) throw new Error('Chat unavailable');
        setMessages(parsed.data.data.messages);
        setRemaining(parsed.data.data.remaining);
        setLimit(parsed.data.data.limit);
        setAvailable(parsed.data.data.available);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(t('report.chat.away'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, owner, url, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (busy) end.current?.scrollIntoView({ block: 'nearest' });
  }, [answer, busy]);
  const send = async () => {
    if (busy || !question.trim()) return;
    const submitted = question.trim();
    if (submitted.length > 120) {
      setError(t('report.chat.tooLong'));
      return;
    }
    setBusy(true);
    setError('');
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
        if (parsed.success && parsed.data.error.code === 'E_QUOTA_EXCEEDED') setRemaining(0);
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
      setError(t('report.chat.away'));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };
  const clear = async () => {
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
  const body = (
    <div className="chat-body">
      <p className="muted">{t('report.chat.privacy')}</p>
      {!owner ? (
        <Link className="text-link" href="/auth/login">
          {t('report.chat.login')}
        </Link>
      ) : loading ? (
        <p role="status">{t('report.chat.loading')}</p>
      ) : (
        <>
          {!available ? (
            <p role="status">{t('report.chat.away')}</p>
          ) : (
            <p>{t('report.chat.remaining', { remaining, limit })}</p>
          )}
          {messages.length === 0 ? <p className="muted">{t('report.chat.empty')}</p> : null}
          <div
            className="chat-history"
            role="log"
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
              {remaining === 0 ? <p role="status">{t('report.chat.quota')}</p> : null}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <label className="birth-field">
                  {t('report.chat.question')}
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    maxLength={120}
                    rows={3}
                    disabled={busy || remaining === 0}
                  />
                </label>
                <Button disabled={busy || remaining === 0 || !question.trim()}>
                  {t(busy ? 'report.chat.thinking' : 'report.chat.send')}
                </Button>
              </form>
            </>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          {messages.length ? (
            <Button variant="ghost" disabled={busy} onClick={() => void clear()}>
              {t('report.chat.delete')}
            </Button>
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
