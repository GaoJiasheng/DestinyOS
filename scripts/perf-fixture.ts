import { writeFile, readFile } from 'node:fs/promises';
import { interpret } from '../packages/interpret/src/index';
import type { KnowledgeBundle } from '../packages/content/src/index';
import { baziReading } from '../apps/web/test/fixtures/bazi-reading';
import { encryptAnonymous } from '../apps/web/lib/anonymous-storage';
/** Generate a full anonymous report from the production knowledge bundle for performance/E2E measurements. */
export async function perfSnapshot() {
  const reading = baziReading('zh');
  const report = interpret({
    system: 'bazi',
    chart: reading.chart,
    locale: 'zh',
    knowledge: JSON.parse(
      await readFile('packages/content/dist/bazi.zh.json', 'utf8'),
    ) as KnowledgeBundle,
    context: { now: '2026-10-05T00:00:00Z', profileHasTime: true },
  });
  return encryptAnonymous({
    anonId: '22222222-2222-4222-8222-222222222222',
    profile: reading.request.birth,
    readings: [{ ...reading, report }],
    settings: {},
  });
}
if (process.argv[1]?.endsWith('perf-fixture.ts')) {
  void perfSnapshot().then((snapshot) => writeFile('/tmp/destiny-perf-fixture.json', snapshot));
}
