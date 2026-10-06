import { AstroChartSchema, DailyChartSchema } from '@tianji/shared';
import { normalizeBirth, hashSeed } from '@tianji/engine';
import { fixtureChart, fixtureReport, reportSignature, systems } from '../lib/diagnostics/fixture';
import expected from '../lib/diagnostics/fixture-reference.json';
import dailyGolden from '../../../packages/engine/test/fixtures/daily/A.json';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import baziGolden from '../../../packages/engine/test/fixtures/bazi/A.json';
jest.setTimeout(30000);
for (const system of systems)
  for (const locale of ['zh', 'en'] as const) {
    it(`${system}/${locale} matches Node reference sections, hit IDs and exact report lengths`, () => {
      const { report } = fixtureReport(system, locale);
      expect(reportSignature(report)).toEqual(expected[system][locale]);
      expect(report.readability.passed).toBe(true);
      expect(report.disclaimerKey).toBe('common.disclaimer');
    });
  }
it('retains independent daily golden data and astrology astronomical tolerances', () => {
  expect(DailyChartSchema.parse(fixtureChart('daily'))).toEqual(dailyGolden);
  const astro = AstroChartSchema.parse(fixtureChart('astrology'));
  expect(astro.bodies.find((b) => b.key === 'sun')!.lon).toBeCloseTo(53.89359, 1);
  expect(normalizeBirth(A).solarTime).toEqual(normalizeBirth(baziGolden.input).solarTime);
  expect(hashSeed('天机 🪙')).toHaveLength(64);
});
