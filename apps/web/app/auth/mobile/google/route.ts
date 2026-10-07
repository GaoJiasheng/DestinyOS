import { z } from 'zod';
/** Relay the registered Google HTTPS redirect to Android; the Worker verifies both PKCE proofs before issuing a session. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const result = z
    .object({ state: z.string().uuid(), code: z.string().min(1).max(4096) })
    .safeParse({ state: params.get('state'), code: params.get('code') });
  if (!result.success) return new Response(null, { status: 400 });
  // DESIGN-GAP: Keep authorization codes in fragments, never in native request logs/history; arbitrary callback destinations are rejected.
  return new Response(null, {
    status: 303,
    headers: {
      Location: `tianji://auth/callback#${new URLSearchParams(result.data)}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
