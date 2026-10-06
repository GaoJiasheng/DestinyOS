import { BaziChartSchema } from '@tianji/shared';
import type { LocalReading } from '../../lib/reading-schema';
import chartFixture from '../../../../packages/content/test/fixtures/bazi.engine-a.json' with { type: 'json' };
import plan from '../../../../packages/interpret/src/plans/bazi.json' with { type: 'json' };

export const baziFixture = BaziChartSchema.parse(chartFixture);
/** Deterministic saved report fixture; chart fields come from the existing engine Fixture A. */
export function baziReading(locale: 'zh' | 'en'): LocalReading {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    system: 'bazi',
    createdAt: '2026-10-05T00:00:00Z',
    title: null,
    chart: baziFixture,
    meta: {
      schoolUsed: {
        ziHour: 'zi_unified',
        useApparentSolarTime: true,
        strengthMethod: 'weighted_v1',
      },
      warnings: [],
    },
    request: {
      idempotencyKey: '33333333-3333-4333-8333-333333333335',
      locale,
      system: 'bazi',
      birth: {
        calendar: 'gregorian',
        year: 1990,
        month: 5,
        day: 15,
        hour: 8,
        minute: 30,
        timeUnknown: false,
        gender: 'male',
        place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
      },
    },
    report: {
      system: 'bazi',
      locale,
      knowledgeVersion: 'fixture',
      engineVersion: 'fixture',
      interpretVersion: 'fixture',
      headline: {
        persona: plan[0]!.title[locale],
        keywords: [],
        scores: { career: 3, wealth: 3, love: 3, health: 3, social: 3 },
        confidence: baziFixture.strength.confidence,
      },
      sections: plan.map((section) => ({
        key: section.key,
        title: section.title[locale],
        lead: section.title[locale],
        blocks: [
          {
            type: 'evidence' as const,
            items: [
              {
                label: section.title[locale],
                path:
                  section.key === 'day_master'
                    ? 'pillars.day.stem'
                    : section.key === 'elements'
                      ? 'elements.pct.wood'
                      : section.key === 'luck_timeline'
                        ? 'years[isCurrent=true].tenGod'
                        : 'pillars.year',
                value: section.title[locale],
                anchor: 'chart-root',
              },
            ],
          },
          ...(section.chartRef ? [{ type: 'chart_ref' as const, ...section.chartRef }] : []),
        ],
      })),
      hits: [],
      readability: { zhChars: 0, enWords: 0, termDensity: 0, passed: true, issues: [] },
      disclaimerKey: 'legal.disclaimer.full',
    },
  };
}
