import { testDatabaseUrl } from '../../../scripts/sqlite-test';
import { randomUUID } from 'node:crypto';
import { db, birth } from './m5-helpers';
import { generateReading, json } from '../lib/reading-service';
import { encryptField } from '../lib/crypto';
export const systems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'numerology',
] as const;
// Fixture A follows launch-check's documented fixed birth/clock, number cast and seeded Celtic Cross.
/** Persist the documented Fixture A snapshot for real authenticated export acceptance. */
export async function seedExportReading(
  userId: string,
  system: (typeof systems)[number],
  locale: 'zh' | 'en',
) {
  const now = '2026-10-04T00:00:00Z';
  const input = {
    system,
    locale,
    birth,
    idempotencyKey: randomUUID(),
    seed: 'fixture-A',
    ...(system === 'tarot' ? { spread: 'celtic_cross' as const } : {}),
    ...(system === 'iching'
      ? {
          method: 'meihua' as const,
          category: 'career',
          numbers: [1, 8, 1] as [number, number, number],
        }
      : {}),
    ...(system === 'qimen'
      ? {
          question: {
            at: `${now}[UTC]`,
            place: { lng: birth.place!.lng, tz: birth.place!.tz },
            category: 'general',
          },
        }
      : {}),
  };
  const result = await generateReading(input, now);
  return db.reading.create({
    data: {
      userId,
      system,
      encInput: encryptField(JSON.stringify(input), 'Reading.encInput', userId),
      chart: json(result.chart),
      reportZh: locale === 'zh' ? json(result.report) : undefined,
      reportEn: locale === 'en' ? json(result.report) : undefined,
      schoolUsed: json(result.meta.schoolUsed),
      engineVersion: result.report.engineVersion,
      interpretVersion: result.report.interpretVersion,
      knowledgeVersion: result.report.knowledgeVersion,
      createdAt: new Date(now),
    },
  });
}
process.env.LOCAL_DATABASE_URL = testDatabaseUrl(57552);
