import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiError, errorResponse } from '@/lib/api-error';
import { stateRead, stateReserve, stateRelease } from '@/lib/state';
import { getDb } from '@/lib/db';
import { refreshRevenuecat } from '@/lib/revenuecat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const payloadSchema = z.object({
  event: z.object({
    id: z.string().min(1).max(255),
    app_user_id: z.string().min(1).max(255).optional(),
    original_app_user_id: z.string().min(1).max(255).optional(),
    aliases: z.array(z.string().min(1).max(255)).max(100).optional(),
    transferred_from: z.array(z.string().min(1).max(255)).max(100).optional(),
    transferred_to: z.array(z.string().min(1).max(255)).max(100).optional(),
    type: z.string().min(1),
  }),
});

function verified(body: string, header: string | null, secret: string): boolean {
  // DESIGN-GAP: Use RevenueCat's integration HMAC over timestamp.rawBody with a five-minute replay tolerance.
  const parts = header?.match(/^t=(\d+),v1=([a-fA-F0-9]{64})$/);
  if (!parts || Math.abs(Date.now() / 1000 - Number(parts[1])) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${parts[1]}.${body}`).digest();
  return timingSafeEqual(expected, Buffer.from(parts[2]!, 'hex'));
}

/** Verify, deduplicate, and reconcile mobile pro using authoritative RevenueCat customer state. */
export async function POST(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const authorization = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  if (!secret && !authorization)
    return errorResponse(new ApiError('E_PAYMENT', 'Mobile billing unavailable', 503));
  if (Number(request.headers.get('content-length') ?? 0) > 65536)
    return errorResponse(new ApiError('E_VALIDATION', 'Webhook too large', 400));
  const body = await request.text();
  if (body.length > 65536)
    return errorResponse(new ApiError('E_VALIDATION', 'Webhook too large', 400));
  // DESIGN-GAP: Support dashboard Authorization and optional timestamped HMAC; when both are configured both are required.
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(authorization ?? '');
  if (
    (authorization && (actual.length !== expected.length || !timingSafeEqual(actual, expected))) ||
    (secret && !verified(body, request.headers.get('X-RevenueCat-Webhook-Signature'), secret))
  )
    return errorResponse(new ApiError('E_PAYMENT', 'Invalid webhook signature', 401));
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(body));
  } catch {
    return errorResponse(new ApiError('E_VALIDATION', 'Invalid webhook payload', 400));
  }
  const key = `revenuecat:event:${payload.event.id}`,
    lock = `${key}:lock`,
    token = randomUUID();
  try {
    if (await stateRead(key)) return Response.json({ ok: true, data: { result: 'duplicate' } });
    if (!(await stateReserve(lock, token, 60)))
      throw new ApiError('E_PAYMENT', 'Webhook processing; retry', 503);
    try {
      if (await stateRead(key)) return Response.json({ ok: true, data: { result: 'duplicate' } });
      const event = payload.event;
      if (event.type !== 'TEST') {
        if (
          event.type === 'TRANSFER' &&
          (!event.transferred_from?.length || !event.transferred_to?.length)
        )
          throw new ApiError('E_VALIDATION', 'Transfer identities required', 400);
        const identities = [
          ...new Set(
            [
              event.app_user_id,
              event.original_app_user_id,
              ...(event.aliases ?? []),
              ...(event.transferred_from ?? []),
              ...(event.transferred_to ?? []),
            ].filter((id): id is string => Boolean(id)),
          ),
        ];
        if (!identities.length)
          throw new ApiError('E_VALIDATION', 'Subscriber identity required', 400);
        // Only actual User.id values are reconciled. Email addresses and anonymous RevenueCat aliases never become account IDs.
        const users = await getDb().user.findMany({
          where: { id: { in: identities } },
          select: { id: true },
        });
        for (const user of users)
          if (!(await refreshRevenuecat(user.id)))
            throw new ApiError('E_PAYMENT', 'RevenueCat unavailable', 503);
      }
      // DESIGN-GAP: Retain accepted callback IDs for 90 days; repeat reconciliation uses authoritative provider state and remains idempotent.
      await stateReserve(key, 'done', 90 * 86400);
      return Response.json({ ok: true, data: { result: 'processed' } });
    } finally {
      await stateRelease(lock, token);
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) return errorResponse(error);
    return errorResponse(new ApiError('E_PAYMENT', 'Webhook processing failed; retry', 503));
  }
}
