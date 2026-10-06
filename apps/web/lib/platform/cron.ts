import { cleanExpiredState } from '../state';
import { aggregateEvents } from '../events';
import { scrubFeedback, maintainShares } from '../maintenance';
import { hardDeleteAccounts } from '../account-service';
/** Shared daily job used by Vercel's authenticated route and Workers scheduled dispatch. */
export async function dailyMaintenance() {
  await cleanExpiredState();
  return {
    aggregates: await aggregateEvents(),
    deleted: await hardDeleteAccounts(),
    scrubbed: await scrubFeedback(),
    expiredShares: await maintainShares(),
  };
}
