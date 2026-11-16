import type { LocalRecord } from './models';
import type { getLocalStore } from './store';

type Store = Awaited<ReturnType<typeof getLocalStore>>;
export const LOCAL_EXPORT_VERSION = 1;
const PAGE = 500;
// Only user-facing preferences. Onboarding/age-gate markers and the active-profile pointer are internal state.
const SETTING_KEYS = [
  'locale',
  'tz',
  'theme',
  'soundOn',
  'reducedMotion',
  'hapticsOn',
  'dailyPushEnabled',
  'dailyPushTime',
  'specialDayReminders',
  'widgetTheme',
] as const;

async function all<T>(
  page: (limit: number, offset: number) => Promise<LocalRecord<T>[]>,
): Promise<LocalRecord<T>[]> {
  const out: LocalRecord<T>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = await page(PAGE, offset);
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
/**
 * Device data in the same shape as the web account export (`/api/v1/me/export`), plus version and
 * exportedAt so a future import can recognise it. Daily snapshots are caches and are left out.
 */
export async function buildLocalExport(store: Store, now = new Date()) {
  const [profiles, readings, journal, settings] = await Promise.all([
    all((l, o) => store.profiles.list(l, o)),
    all((l, o) => store.readings.listBySystem({ except: ['daily'] }, l, o)),
    all((l, o) => store.journal.list(l, o)),
    store.settings.list(1, 0),
  ]);
  const prefs: Record<string, unknown> = {},
    current = settings[0]?.data;
  if (current) for (const key of SETTING_KEYS) prefs[key] = current[key];
  return {
    version: LOCAL_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    source: 'device',
    user: prefs,
    profiles: profiles.flatMap(({ id, createdAt, data }) =>
      data
        ? [
            {
              id,
              label: data.name,
              isDefault: data.isDefault ?? false,
              relation: data.relation ?? null,
              version: data.version,
              isCurrent: data.isCurrent,
              birth: data.birth,
              name: data.name,
              options: data.options,
              createdAt,
            },
          ]
        : [],
    ),
    readings: readings.flatMap(({ id, createdAt, data }) =>
      data
        ? [
            {
              id,
              profileId: data.profileId,
              partnerProfileId: data.inputSnapshot.partnerProfileId ?? null,
              system: data.system,
              createdAt,
              title: data.title,
              input: data.inputSnapshot,
              chart: data.chart,
              reportZh: data.reportZh,
              reportEn: data.reportEn,
              engineVersion: data.engineVersion,
              knowledgeVersion: data.knowledgeVersion,
            },
          ]
        : [],
    ),
    journalEntries: journal.flatMap(({ id, createdAt, data }) =>
      data ? [{ id, createdAt, ...data }] : [],
    ),
  };
}
export type LocalExport = Awaited<ReturnType<typeof buildLocalExport>>;
/** Local calendar date, so the file name matches the day the user sees. */
export function exportFileName(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `tianji-export-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
/** Write the JSON to the cache and open the system share sheet; the file is removed afterwards. */
export async function shareLocalExport(store: Store, dialogTitle: string, now = new Date()) {
  const [{ File, Paths }, Sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);
  if (!(await Sharing.isAvailableAsync())) throw new Error('E_SHARE');
  const payload = await buildLocalExport(store, now);
  const file = new File(Paths.cache, exportFileName(now));
  try {
    if (file.exists) file.delete();
    file.write(JSON.stringify(payload, null, 2));
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle,
    });
  } finally {
    if (file.exists) file.delete();
  }
}
