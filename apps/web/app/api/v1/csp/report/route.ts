import { requestIp } from '@/lib/request-ip';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { ratelimit } from '@/lib/ratelimit';
const schema = z.object({
  'csp-report': z.object({
    'violated-directive': z.string().max(80),
    'blocked-uri': z.string().max(2048).optional(),
  }),
});
/** Store directive/hostname counts only; never persist URL paths, queries, script samples or request bodies. */
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 16384)
      return new Response(null, { status: 413 });
    const text = await request.text();
    if (text.length > 16384) return new Response(null, { status: 413 });
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) return new Response(null, { status: 400 });
    const directive = parsed.data['csp-report']['violated-directive'].split(' ')[0];
    if (
      !directive ||
      !/^(?:default|script|frame|img|style|font|connect|object|base|frame-ancestors)(?:-src(?:-elem|-attr)?|-uri)?$/.test(
        directive,
      )
    )
      return new Response(null, { status: 400 });
    let blockedHost: string | null = null;
    const blocked = parsed.data['csp-report']['blocked-uri'];
    if (blocked) {
      try {
        const url = new URL(blocked);
        if (url.protocol === 'https:' || url.protocol === 'http:') blockedHost = url.hostname;
      } catch {
        /* Inline/eval reports have no remote host. */
      }
    }
    // DESIGN-GAP: Reuse the feedback quota for anonymous CSP counts; missing telemetry infrastructure drops counts without breaking pages.
    if ((await ratelimit('feedback', requestIp(request.headers))).success)
      await getDb().event.create({
        data: {
          day: new Date(new Date().toISOString().slice(0, 10)),
          name: 'csp.violation',
          props: { directive, blockedHost },
        },
      });
  } catch {
    /* Reporting must remain best-effort and reveal no internal error. */
  }
  return new Response(null, { status: 204 });
}
