import { z } from 'zod';
export const historySchema = z.object({
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
export const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), code: z.string() }),
]);
export const errorSchema = z.object({ error: z.object({ code: z.string() }) });
export type Message = { id: string; role: 'user' | 'assistant'; content: string };
/** The quota resets at 00:00 UTC; name that moment in the reader's own clock (08:00 in China). */
export function localResetTime(locale: string, now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(next);
}
