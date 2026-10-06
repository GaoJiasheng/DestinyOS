import { cleanExpiredState } from '../state';
import { aggregateEvents } from '../events';
import { scrubFeedback, maintainShares } from '../maintenance';
import { getDb } from '../db';
import { hardDeleteAccounts } from '../account-service';
/** Shared daily job used by Vercel's authenticated route and Workers scheduled dispatch. */
export async function dailyMaintenance() {
  await cleanExpiredState();
  // DESIGN-GAP: Expired mobile device sessions are removed by the existing daily Worker job.
  await getDb().mobileSession.deleteMany({ where: { refreshExpiresAt: { lte: new Date() } } });
  return {
    aggregates: await aggregateEvents(),
    deleted: await hardDeleteAccounts(),
    scrubbed: await scrubFeedback(),
    expiredShares: await maintainShares(),
  };
}
