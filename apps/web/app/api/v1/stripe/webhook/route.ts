import type Stripe from 'stripe';
import { ApiError, errorResponse } from '@/lib/api-error';
import { getStripe } from '@/lib/stripe';
import { handleStripeEvent } from '@/lib/stripe-webhook';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Verify the unmodified Stripe payload before any D1 access. */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY)
    return errorResponse(new ApiError('E_PAYMENT', 'Billing unavailable', 503));
  const signature = request.headers.get('stripe-signature');
  if (!signature) return errorResponse(new ApiError('E_PAYMENT', 'Invalid webhook signature', 400));
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return errorResponse(new ApiError('E_PAYMENT', 'Invalid webhook signature', 400));
  }
  try {
    return Response.json({ ok: true, data: { result: await handleStripeEvent(event) } });
  } catch {
    return errorResponse(new ApiError('E_PAYMENT', 'Webhook processing failed; retry', 503));
  }
}
