import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { localToday } from '../apps/web/lib/daily-date';
import { calculateDaily } from '../apps/web/lib/daily-compute';
import { dailyExample, dailyExamplePath } from '../apps/web/lib/daily-example';
import type { KnowledgeBundle } from '../packages/content/src';
/** Materialize public demonstration reports; personal births always use the route-local engine. */
export async function dailyExampleAssets(directory: string): Promise<number> {
  // DESIGN-GAP: Cache the example for yesterday through the next seven days in common audience zones; other dates/zones and stale builds fall back to the unchanged pure client computation.
  const zones = [
    'UTC',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Taipei',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
  ];
  let count = 0;
  for (const locale of ['zh', 'en', 'zh-TW'] as const) {
    const knowledge = JSON.parse(
      await readFile(
        resolve(import.meta.dirname, '../packages/content/dist', `daily.${locale}.json`),
        'utf8',
      ),
    ) as KnowledgeBundle;
    for (const tz of zones) {
      const today = localToday(tz);
      for (let offset = -1; offset <= 7; offset++) {
        const date = new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const seed = createHash('sha256').update(`example|${date}`).digest('hex');
        const report = calculateDaily(dailyExample, date, tz, seed, locale, knowledge);
        const destination = resolve(directory, dailyExamplePath(locale, tz, date).slice(1));
        await mkdir(resolve(destination, '..'), { recursive: true });
        await writeFile(destination, JSON.stringify(report) + '\n');
        count++;
      }
    }
  }
  return count;
}
