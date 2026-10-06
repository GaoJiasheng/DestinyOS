import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auth } from './auth';
import { getDb } from './db';
import { ApiError } from './api-error';
import { siteConfig } from './site-config';
import { decryptField, encryptField } from './crypto';
import { assertRateLimit, ratelimit } from './ratelimit';
import { stateReserve, stateRelease } from './state';
import { atomicBatch, guard, insertRow } from './db-batch';
import { digest, readingView } from './reading-service';
import { searchCities } from './geo';
import { parseReadingChart } from './reading-schema';
import { recordEvent } from './events';
import { chatMessages, privateIdentifiers } from './llm/context';
import type { TokenUsage } from './llm/minimax';
import { streamChatReply } from './llm/reply';

export const ChatRequestSchema = z
  .object({ locale: z.enum(['zh', 'en', 'zh-TW']), question: z.string().trim().min(1).max(120) })
  .strict();
export type ChatHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};
/** UTC quota boundary, shared across all readings and locales. */
export function chatDay(now = new Date()): Date {
  return new Date(now.toISOString().slice(0, 10));
}
/** Verify live account and reading ownership before reading/decrypting any private dialogue. */
export async function chatOwner(rawId: string) {
  const id = z.string().min(1).max(100).parse(rawId);
  const session = await auth();
  if (!session?.user.id) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  const db = getDb();
  const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null } });
  if (!user) throw new ApiError('E_UNAUTHORIZED', 'Sign in required', 401);
  const reading = await db.reading.findFirst({ where: { id, userId: user.id } });
  if (!reading) throw new ApiError('E_FORBIDDEN', 'Reading access denied', 403);
  return { db, user, reading };
}
/** Decrypt owner-scoped history only; reading IDs/public share links cannot bypass ownership. */
export async function chatHistory(id: string) {
  const { db, user, reading } = await chatOwner(id);
  assertRateLimit(await ratelimit('chat', user.id));
  const settings = await siteConfig();
  // DESIGN-GAP: Return the latest 500 messages to bound UI payloads; all stored messages remain exportable/deletable.
  const rows = await db.chatMessage.findMany({
    where: { readingId: reading.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  });
  const quota = await db.chatQuota.findUnique({
    where: { userId_day: { userId: user.id, day: chatDay() } },
  });
  const limit = settings[user.plan === 'pro' ? 'chat.proDailyLimit' : 'chat.freeDailyLimit'];
  return {
    available: settings['feature.llmChat'] && Boolean(process.env.MINIMAX_API_KEY),
    remaining: Math.max(0, limit - (quota?.count ?? 0)),
    limit,
    messages: rows.reverse().map((row): ChatHistoryMessage => ({
      id: row.id,
      role: z.enum(['user', 'assistant']).parse(row.role),
      content: decryptField(row.content, 'ChatMessage.content', user.id),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
/** Delete dialogue without resetting quota, serialized against active generation. */
export async function deleteChat(id: string) {
  const owner = await chatOwner(id);
  assertRateLimit(await ratelimit('chat', owner.user.id));
  const release = await lockReading(id);
  try {
    await owner.db.chatMessage.deleteMany({ where: { readingId: id } });
    await recordEvent('chat.deleted', { userId: owner.user.id, system: owner.reading.system });
  } finally {
    await release();
  }
}
async function lockReading(id: string) {
  const key = `chat:lock:${digest(id)}`,
    token = randomUUID();
  const locked = await stateReserve(key, token, 180);
  if (!locked)
    throw new ApiError('E_RATE_LIMITED', 'Chat already in progress', 429, { retryAfter: 120 });
  return async () => {
    await stateRelease(key, token);
  };
}
/** Atomically reserve a daily question; transaction rollback prevents concurrent overspending. */
export async function reserveChatQuota(userId: string, limit: number, day = chatDay()) {
  const rows = await getDb().$queryRawUnsafe<{ count: number }[]>(
    `INSERT INTO "ChatQuota" ("userId",day,count) SELECT ?,?,1 WHERE ? > 0 ON CONFLICT("userId",day) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count`,
    userId,
    day.toISOString().replace('Z', '+00:00'),
    limit,
    limit,
  );
  if (!rows.length) throw new ApiError('E_QUOTA_EXCEEDED', 'Daily chat quota exceeded', 429);
}
/** Prepare private context and reserve limits before opening a stream; failed/cancelled generations refund daily quota. */
export async function prepareChat(id: string, raw: unknown, signal: AbortSignal) {
  const req = ChatRequestSchema.parse(raw);
  const { db, user, reading } = await chatOwner(id);
  assertRateLimit(await ratelimit('chat', user.id));
  const settings = await siteConfig();
  if (!settings['feature.llmChat'] || !process.env.MINIMAX_API_KEY)
    throw new ApiError('E_INTERNAL', 'LLM unavailable', 503);
  const release = await lockReading(id);
  const day = chatDay();
  let reserved = false;
  try {
    const chart = parseReadingChart(reading.system, reading.chart);
    const view = await readingView(reading, req.locale, true);
    const snapshot: unknown = JSON.parse(reading.encInput);
    const identities = [...privateIdentifiers(snapshot), ...privateIdentifiers(user)];
    const birth = z
      .object({
        birth: z
          .object({ place: z.object({ name: z.string() }).passthrough().optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .parse(snapshot).birth;
    if (birth?.place?.name) {
      const cities = await searchCities(birth.place.name, 'zh');
      identities.push(birth.place.name, ...cities.map((city) => city.name));
      const english = await searchCities(birth.place.name, 'en');
      identities.push(...english.map((city) => city.name));
    }
    const prior = await db.chatMessage.findMany({
      where: { readingId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 12,
    });
    const history = prior.reverse().map((row) => ({
      role: z.enum(['user', 'assistant']).parse(row.role),
      content: decryptField(row.content, 'ChatMessage.content', user.id),
    }));
    const messages = await chatMessages({
      system: reading.system,
      chart,
      report: view.report,
      locale: req.locale,
      question: req.question,
      identities,
      history,
    });
    const limit = settings[user.plan === 'pro' ? 'chat.proDailyLimit' : 'chat.freeDailyLimit'];
    await reserveChatQuota(user.id, limit, day);
    reserved = true;
    let finished = false;
    const stream = async function* () {
      let content = '',
        usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      try {
        for await (const event of streamChatReply(
          messages,
          { question: req.question, locale: req.locale, identities },
          { signal },
        )) {
          if (event.type === 'usage') usage = event.usage;
          else {
            content += event.text;
            yield event;
          }
        }
        if (signal.aborted) throw new Error('Cancelled chat');
        // DESIGN-GAP: Store both turns atomically on success; prompt token count includes chart/report/history, completion count includes reasoning.
        await atomicBatch([
          ...guard(
            'EXISTS (SELECT 1 FROM "Reading" r JOIN "User" u ON r."userId"=u.id WHERE r.id=? AND u.id=? AND u."deletedAt" IS NULL)',
            id,
            user.id,
          ),
          insertRow('ChatMessage', {
            readingId: id,
            role: 'user',
            content: encryptField(req.question, 'ChatMessage.content', user.id),
            tokens: usage.promptTokens,
            createdAt: new Date(),
          }),
          insertRow('ChatMessage', {
            readingId: id,
            role: 'assistant',
            content: encryptField(content, 'ChatMessage.content', user.id),
            tokens: usage.completionTokens,
            createdAt: new Date(Date.now() + 1),
          }),
        ]);
        finished = true;
        await recordEvent('chat.completed', {
          userId: user.id,
          system: reading.system,
          locale: req.locale,
          plan: user.plan,
        });
        yield { type: 'done' };
      } catch {
        await recordEvent('chat.failed', {
          userId: user.id,
          system: reading.system,
          locale: req.locale,
          plan: user.plan,
        });
        yield { type: 'error', code: 'E_INTERNAL' };
      } finally {
        if (!finished)
          await db.chatQuota.updateMany({
            where: { userId: user.id, day, count: { gt: 0 } },
            data: { count: { decrement: 1 } },
          });
        await release();
      }
    };
    return stream();
  } catch (error) {
    if (reserved)
      await db.chatQuota.updateMany({
        where: { userId: user.id, day, count: { gt: 0 } },
        data: { count: { decrement: 1 } },
      });
    await release();
    await recordEvent('chat.denied', { userId: user.id, system: reading.system, plan: user.plan });
    throw error;
  }
}
