import { createServer, type IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';

type TestSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  metadata: { userId: string };
  items: { data: Array<{ current_period_end: number; price: { id: string } }> };
};
async function body(request: IncomingMessage) {
  let text = '';
  for await (const chunk of request) text += String(chunk);
  return new URLSearchParams(text);
}
/** Isolated test-mode hosted checkout/portal and Stripe API mock; signs real webhook payloads. */
export async function startStripeMock(port: number, site: string) {
  const origin = `http://127.0.0.1:${port}`,
    stripe = new Stripe('sk_test_m4');
  const subscriptions = new Map<string, TestSubscription>();
  const checkouts = new Map<
    string,
    { userId: string; price: string; success: string; canceled: string }
  >();
  const events: string[] = [];
  async function send(type: string, object: object) {
    const payload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: 'event',
      type,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: { object },
    });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_m4' });
    const response = await fetch(`${site}/api/v1/stripe/webhook`, {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': signature },
    });
    if (!response.ok) throw new Error(`Webhook failed ${response.status}`);
    events.push(type);
  }
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', origin);
      response.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/v1/subscriptions' && request.method === 'GET') {
        response.end(
          JSON.stringify({
            object: 'list',
            has_more: false,
            url: '/v1/subscriptions',
            data: [...subscriptions.values()].map((sub) => ({
              ...sub,
              items: {
                data: sub.items.data.map((item) => ({
                  ...item,
                  quantity: 1,
                  price: {
                    ...item.price,
                    currency: 'usd',
                    unit_amount: item.price.id === 'price_yearly_test' ? 2499 : 299,
                    recurring: {
                      interval: item.price.id === 'price_yearly_test' ? 'year' : 'month',
                      interval_count: 1,
                    },
                  },
                })),
              },
            })),
          }),
        );
      } else if (url.pathname === '/v1/checkout/sessions') {
        const input = await body(request);
        const id = `cs_${randomUUID()}`;
        checkouts.set(id, {
          userId: input.get('client_reference_id') ?? '',
          price: input.get('line_items[0][price]') ?? '',
          success: input.get('success_url') ?? site,
          canceled: input.get('cancel_url') ?? site,
        });
        response.end(JSON.stringify({ id, url: `${origin}/checkout?id=${id}` }));
      } else if (url.pathname === '/checkout') {
        response.setHeader('Content-Type', 'text/html');
        // Test-surface copy is deliberately separate from product UI.
        response.end(
          `<html><body><form method="POST" action="/complete?id=${url.searchParams.get('id')}"><button>Complete test payment</button></form></body></html>`,
        );
      } else if (url.pathname === '/complete') {
        const checkout = checkouts.get(url.searchParams.get('id') ?? '');
        if (!checkout) throw new Error('Checkout missing');
        const sub: TestSubscription = {
          id: `sub_${randomUUID()}`,
          customer: `cus_${randomUUID()}`,
          status: 'active',
          cancel_at_period_end: false,
          metadata: { userId: checkout.userId },
          items: {
            data: [
              {
                current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
                price: { id: checkout.price },
              },
            ],
          },
        };
        subscriptions.set(sub.id, sub);
        await send('checkout.session.completed', {
          customer: sub.customer,
          subscription: sub.id,
          client_reference_id: checkout.userId,
        });
        response.writeHead(303, { Location: checkout.success });
        response.end();
      } else if (url.pathname.startsWith('/v1/subscriptions/')) {
        const sub = subscriptions.get(url.pathname.split('/').at(-1) ?? '');
        if (!sub) throw new Error('Unknown subscription');
        if (request.method === 'DELETE') {
          sub.status = 'canceled';
        }
        response.end(JSON.stringify(sub));
      } else if (url.pathname === '/v1/billing_portal/sessions') {
        const input = await body(request);
        const sub = [...subscriptions.values()].find((s) => s.customer === input.get('customer'));
        if (!sub) throw new Error('Unknown customer');
        const id = sub.id;
        const back = encodeURIComponent(input.get('return_url') ?? site);
        response.end(
          JSON.stringify({ id: 'bps_test', url: `${origin}/portal?id=${id}&back=${back}` }),
        );
      } else if (url.pathname === '/portal') {
        response.setHeader('Content-Type', 'text/html');
        response.end(
          `<html><body><form method="POST" action="/cancel?id=${url.searchParams.get('id')}&back=${encodeURIComponent(url.searchParams.get('back') ?? site)}"><button>Cancel renewal</button></form></body></html>`,
        );
      } else if (url.pathname === '/cancel') {
        const sub = subscriptions.get(url.searchParams.get('id') ?? '');
        if (!sub) throw new Error('Missing subscription');
        sub.cancel_at_period_end = true;
        await send('customer.subscription.updated', sub);
        response.writeHead(303, { Location: url.searchParams.get('back') ?? site });
        response.end();
      } else if (url.pathname === '/expire') {
        const sub = subscriptions.get(url.searchParams.get('id') ?? '');
        if (!sub) throw new Error('Missing subscription');
        sub.status = 'canceled';
        await send('customer.subscription.deleted', sub);
        response.end('{}');
      } else if (url.pathname === '/events') {
        response.end(JSON.stringify(events));
      } else {
        response.writeHead(404);
        response.end();
      }
    })().catch((error: unknown) => {
      console.error(error);
      response.writeHead(500);
      response.end('{}');
    });
  });
  await new Promise<void>((accept) => server.listen(port, '127.0.0.1', accept));
  return server;
}
