import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiError, errorResponse } from '@/lib/api-error';
import { stateRead, stateReserve, stateRelease } from '@/lib/state';
import { mutateBillingOwner } from '@/lib/billing-owner';
import { revenuecatEntitlement } from '@/lib/revenuecat';
import { updateRows } from '@/lib/db-batch';
import { subscriptionPlan } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const payloadSchema = z.object({
  event: z.object({
    id: z.string().min(1).max(255),
    app_user_id: z.string().min(1).max(255),
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
  if (!secret) return errorResponse(new ApiError('E_PAYMENT', 'Mobile billing unavailable', 503));
  const body = await request.text();
  if (!verified(body, request.headers.get('X-RevenueCat-Webhook-Signature'), secret))
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
      // DESIGN-GAP: TEST only checks transport; unsupported transfer/alias identities require a later mobile account workflow.
      if (payload.event.type !== 'TEST') {
        await mutateBillingOwner(payload.event.app_user_id, async (user) => {
          const pro = await revenuecatEntitlement(user.id);
          const lifetime = user.lifetime || pro.lifetime;
          const stripeActive =
            user.subscription?.stripeSubscriptionId &&
            subscriptionPlan(user.subscription.status) === 'pro';
          return [
            updateRows(
              'User',
              {
                lifetime,
                revenuecatProUntil: pro.until,
                plan: lifetime || pro.active || stripeActive ? 'pro' : 'free',
              },
              'id=?',
              user.id,
            ),
          ];
        });
      }
      await stateReserve(key, 'done', 86400);
      return Response.json({ ok: true, data: { result: 'processed' } });
    } finally {
      await stateRelease(lock, token);
    }
  } catch {
    return errorResponse(new ApiError('E_PAYMENT', 'Webhook processing failed; retry', 503));
  }
}
