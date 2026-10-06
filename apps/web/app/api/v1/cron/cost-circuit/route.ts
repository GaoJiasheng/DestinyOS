import { cronAuthorized } from '@/lib/account-service';
import { checkCostCircuit } from '@/lib/cost-circuit';
import { circuitStore } from '@/lib/circuit';
import { ApiError, errorResponse } from '@/lib/api-error';
import { stateReserve, stateRelease } from '@/lib/state';
import { sendEmail } from '@/lib/platform/email';
import { getCopy } from '@/i18n/get-copy';
import { randomUUID } from 'node:crypto';
export const dynamic = 'force-dynamic';
/** Hourly cost guard, authenticated independently and reachable while the circuit is open. */
export async function POST(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization')))
    return errorResponse(new ApiError('E_UNAUTHORIZED', 'Cron authorization required', 401));
  if (!process.env.CF_ANALYTICS_TOKEN || !process.env.CF_ANALYTICS_ACCOUNT_ID)
    return Response.json({ ok: true, data: { result: 'skipped' } });
  const token = randomUUID();
  if (!(await stateReserve('circuit:cron-lock', token, 600)))
    return Response.json({ ok: true, data: { result: 'busy' } });
  try {
    const t = await getCopy('zh');
    const data = await checkCostCircuit(
      {
        CF_ANALYTICS_TOKEN: process.env.CF_ANALYTICS_TOKEN,
        CF_ANALYTICS_ACCOUNT_ID: process.env.CF_ANALYTICS_ACCOUNT_ID,
        CF_BILLING_CYCLE_DAY: process.env.CF_BILLING_CYCLE_DAY,
        ADMIN_EMAILS: process.env.ADMIN_EMAILS,
      },
      {
        store: await circuitStore(),
        notify: async (to, usage) =>
          sendEmail({
            to,
            subject: t('circuit.email.subject'),
            text: t('circuit.email.body', {
              requests: usage.requests,
              cpuMs: Math.ceil(usage.cpuMs),
            }),
          }),
      },
    );
    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return errorResponse(new ApiError('E_INTERNAL', 'Cost check failed', 503));
  } finally {
    await stateRelease('circuit:cron-lock', token);
  }
}
export const GET = POST;
