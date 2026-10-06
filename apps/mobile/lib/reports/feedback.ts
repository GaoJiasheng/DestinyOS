import { getLocalStore } from '../data/store';
/** Read local section votes only after the owner-scoped reading lookup succeeds. */
export async function getFeedback(readingId: string): Promise<Record<string, boolean>> {
  const store = await getLocalStore();
  if (!(await store.readings.get(readingId))) return {};
  const rows = await store.database.read((sql) =>
    sql.getAllAsync<{ section: string; helpful: number }>(
      'SELECT section,helpful FROM ReportFeedback WHERE readingId=?',
      readingId,
    ),
  );
  return Object.fromEntries(rows.map((row) => [row.section, row.helpful === 1]));
}
/** Persist a vote offline without sending chart, birth information or prose to another party. */
export async function saveFeedback(readingId: string, section: string, helpful: boolean) {
  const store = await getLocalStore();
  return store.database.write(async (sql) => {
    const record = await sql.getFirstAsync<{
      data: string;
      userId: string | null;
      deletedAt: string | null;
    }>('SELECT data,userId,deletedAt FROM Reading WHERE id=?', readingId);
    if (!record || record.userId !== null || record.deletedAt) throw new Error('E_FORBIDDEN');
    await sql.runAsync(
      'INSERT INTO ReportFeedback(readingId,section,helpful,updatedAt) VALUES (?,?,?,?) ON CONFLICT(readingId,section) DO UPDATE SET helpful=excluded.helpful,updatedAt=excluded.updatedAt',
      readingId,
      section,
      Number(helpful),
      new Date().toISOString(),
    );
  });
}
