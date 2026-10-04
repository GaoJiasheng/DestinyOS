import { z } from 'zod';

// DESIGN-GAP: A test-process preload captures production Resend requests in the loopback sink without enabling test delivery in application code.
const endpoint = new URL(process.env.TEST_MAIL_URL ?? '');
if (
  process.env.TEST_WEB_MODE !== 'production' ||
  process.env.RESEND_API_KEY !== 're_test' ||
  endpoint.hostname !== '127.0.0.1'
) {
  throw new Error(
    'Production test mail interception requires isolated test credentials and loopback',
  );
}
const originalFetch = globalThis.fetch.bind(globalThis);
const payloadSchema = z.object({
  from: z.string(),
  to: z.union([z.string(), z.array(z.string()).length(1)]),
  subject: z.string(),
  text: z.string(),
  html: z.string(),
});
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'api.resend.com') return originalFetch(input, init);
  const request = new Request(input, init);
  if (request.method !== 'POST' || url.pathname !== '/emails')
    throw new Error('Unexpected production test Resend request');
  const payload = payloadSchema.parse(await request.json());
  const response = await originalFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      to: Array.isArray(payload.to) ? payload.to[0] : payload.to,
    }),
  });
  if (!response.ok) throw new Error('Production test mail sink failed');
  return Response.json({ id: 'isolated-test-email' });
};
