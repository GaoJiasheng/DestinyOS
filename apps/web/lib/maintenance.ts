import { getDb } from './db';
import { scrubText } from './privacy';
/** Scrub anonymous retained feedback in bounded batches; identifiers of the former owner are never audited. */
export async function scrubFeedback() {
  const db = getDb();
  let cursor: string | undefined,
    count = 0;
  // DESIGN-GAP: Anonymous feedback is scrubbed nightly; existing ISO dates/email rules are extended to phones and coordinates.
  for (;;) {
    const rows = await db.feedback.findMany({
      where: { userId: null, text: { not: null } },
      orderBy: { id: 'asc' },
      take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      if (!row.text) continue;
      const text = scrubText(row.text)
        .replace(/\+?\d[\d\s().-]{7,}\d/g, '[REDACTED]')
        .replace(/[-+]?\d{1,3}\.\d{3,}/g, '[REDACTED]');
      if (text !== row.text) {
        await db.feedback.update({ where: { id: row.id }, data: { text } });
        count++;
      }
    }
    cursor = rows.at(-1)?.id;
    if (rows.length < 200) break;
  }
  if (count)
    await db.adminAuditLog.create({
      data: { adminId: 'system:cron', action: 'feedback.scrub', diff: { count } },
    });
  return count;
}
/** Revoke expired shares; view counts are already written directly to Postgres. */
export async function maintainShares(now = new Date()) {
  const db = getDb();
  const expired = await db.shareLink.updateMany({
    where: { expiresAt: { lte: now }, revokedAt: null },
    data: { revokedAt: now },
  });
  // DESIGN-GAP: Share views already write directly to Postgres in share-service; there are no pending Redis counters to flush.
  return expired.count;
}
