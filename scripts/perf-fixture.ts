import { writeFile, readFile } from 'node:fs/promises';
import { interpret } from '../packages/interpret/src/index';
import type { KnowledgeBundle } from '../packages/content/src/index';
import { baziReading } from '../apps/web/test/fixtures/bazi-reading';
import { encryptAnonymous } from '../apps/web/lib/anonymous-storage';
import { computeSynastry } from '../packages/engine/src/synastry';
import { normalizeBirth } from '../packages/engine/src/common';
import { BirthInputSchema } from '../packages/shared/src';
import B from '../packages/engine/test/fixtures/birth/B.json';
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
  const partnerBirth = BirthInputSchema.parse(B);
  const chart = computeSynastry(
    normalizeBirth(reading.request.birth!, 'zh'),
    normalizeBirth(partnerBirth, 'zh'),
    reading.createdAt,
  );
  const paired = {
    ...reading,
    id: '44444444-4444-4444-8444-444444444444',
    system: 'synastry' as const,
    chart,
    request: { ...reading.request, system: 'synastry' as const, partnerBirth },
    report: interpret({
      system: 'synastry',
      chart,
      locale: 'zh',
      knowledge: JSON.parse(
        await readFile('packages/content/dist/synastry.zh.json', 'utf8'),
      ) as KnowledgeBundle,
      context: { now: reading.createdAt, profileHasTime: true },
    }),
  };
  return encryptAnonymous({
    anonId: '22222222-2222-4222-8222-222222222222',
    profile: reading.request.birth,
    readings: [{ ...reading, report }, paired],
    settings: {},
  });
}
if (process.argv[1]?.endsWith('perf-fixture.ts')) {
  void perfSnapshot().then((snapshot) => writeFile('/tmp/destiny-perf-fixture.json', snapshot));
}
