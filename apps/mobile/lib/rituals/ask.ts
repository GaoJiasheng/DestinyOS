/** Ritual entry with an optional question carried over from the ask sheet. */
export function askRoute(kind: 'tarot' | 'meihua' | 'liuyao', question: string) {
  const q = question.trim().slice(0, 120);
  const extra = q ? { question: q } : {};
  return kind === 'tarot'
    ? { pathname: '/tarot/reading' as const, params: { spread: 'single', ...extra } }
    : {
        pathname: '/iching' as const,
        params: { method: kind === 'meihua' ? 'random' : 'liuyao', ...extra },
      };
}

/**
 * Newest report that belongs to the active profile (same rule as history), skipping daily
 * records, so "ask the master" can open its follow-up chat directly.
 */
export async function latestReportId(profileId: string | undefined) {
  // Loaded on demand so opening the sheet never pulls the encrypted store into its bundle path.
  const [{ getLocalStore }, { ReportSystemSchema }] = await Promise.all([
    import('../data/store'),
    import('../reports/readings'),
  ]);
  const store = await getLocalStore();
  const items = await store.readings.list(500);
  return (
    items.find(
      (item) =>
        ReportSystemSchema.safeParse(item.data?.system).success &&
        (!item.data?.profileId ||
          item.data.profileId === profileId ||
          item.data.inputSnapshot.partnerProfileId === profileId),
    )?.id ?? null
  );
}
