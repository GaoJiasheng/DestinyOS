import { randomUUID } from 'node:crypto';
import { cronAuthorized } from '@/lib/account-service';
import { ApiError, errorResponse } from '@/lib/api-error';
import { circuitStore } from '@/lib/circuit';
import { getCopy } from '@/i18n/get-copy';
import { logger } from '@/lib/logger';
import { circuitOpen } from '@/lib/platform/circuit-policy';
import { stateRelease, stateReserve } from '@/lib/state';
import { webPushEnabled } from '@/lib/web-push-flag';
import { PUSH_LOCALES, type PushLocale, type ReminderCopy } from '@/lib/web-push-schedule';
import { sendDueReminders } from '@/lib/web-push-service';
export const dynamic = 'force-dynamic';
const lockKey = 'web-push:cron-lock';
const skipped = (result: string) =>
  Response.json({ ok: true, data: { result } }, { headers: { 'Cache-Control': 'no-store' } });
async function reminderCopy(): Promise<Record<PushLocale, ReminderCopy>> {
  const entries = await Promise.all(
    PUSH_LOCALES.map(async (locale) => {
      const t = await getCopy(locale);
      return [locale, { title: t('push.reminder.title'), body: t('push.reminder.body') }] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<PushLocale, ReminderCopy>;
}
/** Hourly daily-reminder sender; authenticated like other cron routes and inert while off or tripped. */
export async function POST(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization')))
    return errorResponse(new ApiError('E_UNAUTHORIZED', 'Cron authorization required', 401));
  if (!webPushEnabled()) return skipped('disabled');
  const subject = process.env.VAPID_SUBJECT;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!subject || !privateKey || !publicKey) return skipped('unconfigured');
  if (await circuitOpen(await circuitStore())) return skipped('circuit_open');
  const token = randomUUID();
  if (!(await stateReserve(lockKey, token, 300))) return skipped('busy');
  try {
    const data = await sendDueReminders({
      vapid: { subject, keys: { publicKey, privateKey } },
      copy: await reminderCopy(),
    });
    return Response.json(
      { ok: true, data: { result: 'done', ...data } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error({ err: error }, 'Web push run failed');
    return errorResponse(new ApiError('E_INTERNAL', 'Web push run failed', 503));
  } finally {
    await stateRelease(lockKey, token);
  }
}
export const GET = POST;
