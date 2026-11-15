import type { AnonymousData } from './anonymous-storage';
import type { ActionResult } from './reading-schema';
import type { ImportItemResult, ProfileImportOutcome } from './reading-import';
/** Keep in step with IMPORT_BATCH_SIZE on the server. */
export const CLIENT_IMPORT_BATCH = 10;
export type ImportBatchPayload = {
  anonId: string;
  profile?: AnonymousData['profile'];
  displayName?: string;
  saveProfile: boolean;
  readings: {
    id: string;
    request: unknown;
    chart: unknown;
    meta: unknown;
    createdAt: string;
  }[];
};
export type ImportBatchResult = ActionResult<{
  results: ImportItemResult[];
  profile: ProfileImportOutcome;
}>;
export type ImportSummary = {
  imported: number;
  failed: number;
  /** Local IDs the account now holds; only these may leave the device. */
  doneIds: string[];
  profile: ProfileImportOutcome;
};
/** Outcomes that mean the account already holds the device profile. */
export const profileStored = (outcome: ProfileImportOutcome) =>
  outcome === 'created' || outcome === 'savedOther' || outcome === 'duplicate';
// Only these stop the whole import; other batch failures keep that batch on the device and move on.
const fatal = new Set(['E_AGE_RESTRICTED', 'E_UNAUTHORIZED']);
/** Send a device snapshot in small batches, reporting progress after each one. */
export async function importInBatches(
  data: AnonymousData,
  saveProfile: boolean,
  send: (payload: ImportBatchPayload) => Promise<ImportBatchResult>,
  onProgress: (done: number, total: number) => void,
): Promise<ImportSummary | { error: string }> {
  const total = data.readings.length;
  const summary: ImportSummary = { imported: 0, failed: 0, doneIds: [], profile: 'none' };
  const batches = Math.max(1, Math.ceil(total / CLIENT_IMPORT_BATCH));
  onProgress(0, total);
  for (let index = 0; index < batches; index++) {
    const slice = data.readings.slice(
      index * CLIENT_IMPORT_BATCH,
      (index + 1) * CLIENT_IMPORT_BATCH,
    );
    // The profile rides with the first batch only, so it is never saved twice.
    const first = index === 0;
    if (!slice.length && !(first && data.profile)) break;
    let result: ImportBatchResult;
    try {
      result = await send({
        anonId: data.anonId,
        ...(first && data.profile ? { profile: data.profile, displayName: data.displayName } : {}),
        saveProfile,
        readings: slice.map(({ id, request, chart, meta, createdAt }) => ({
          id,
          request,
          chart,
          meta,
          createdAt,
        })),
      });
    } catch {
      result = { ok: false, error: { code: 'E_INTERNAL' } };
    }
    if (!result.ok) {
      if (fatal.has(result.error.code)) return { error: result.error.code };
      summary.failed += slice.length;
      if (first && data.profile) summary.profile = 'failed';
    } else {
      if (first) summary.profile = result.data.profile;
      result.data.results.forEach((item, position) => {
        const local = slice[position];
        if (!local) return;
        if (item.status === 'failed') summary.failed++;
        else {
          summary.imported++;
          summary.doneIds.push(local.id);
        }
      });
    }
    onProgress(Math.min(total, (index + 1) * CLIENT_IMPORT_BATCH), total);
  }
  return summary;
}
