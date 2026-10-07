import { z } from 'zod';
/** Relay Apple's registered HTTPS form_post to the native browser session; never issue credentials here. */
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 20000)
    return new Response(null, { status: 400 });
  const raw = await request.text();
  if (raw.length > 20000) return new Response(null, { status: 400 });
  const params = new URLSearchParams(raw);
  const parsed = z
    .object({ state: z.string().uuid(), id_token: z.string().min(1).max(12000) })
    .safeParse({ state: params.get('state'), id_token: params.get('id_token') });
  if (!parsed.success) return new Response(null, { status: 400 });
  // DESIGN-GAP: Provider JWT travels in a fragment so it is excluded from HTTP request logs. The App/Worker verify state, nonce, audience and PKCE before login.
  const fragment = new URLSearchParams(parsed.data).toString();
  return new Response(null, {
    status: 303,
    headers: {
      Location: `tianji://auth/callback#${fragment}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
