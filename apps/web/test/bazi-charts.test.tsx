// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { Element, type BaziChart } from '@tianji/shared';
import { ChartPreview } from '../components/report/chart-preview';
import { ReportLayout } from '../components/report/report-layout';
import { ReportSection } from '../components/report/report-section';
import { BranchRelationDiagram } from '../components/charts/branch-relation-diagram';
import { LuckTimeline } from '../components/charts/luck-timeline';
import {
  baziSection,
  chartPath,
  isHighlighted,
  PILLAR_KEYS,
  resolveChartPaths,
} from '../components/charts/bazi-shared';
import { baziFixture, baziReading } from './fixtures/bazi-reading';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';

vi.mock('../app/readings/actions', () => ({ submitFeedbackAction: vi.fn() }));
vi.mock('../i18n/navigation', () => ({ Link: 'a', useRouter: () => ({ push: vi.fn() }) }));
beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});
afterEach(cleanup);

for (const [locale, messages] of [
  ['zh', zh],
  ['en', en],
] as const) {
  const wrap = (node: React.ReactNode) => (
    <NextIntlClientProvider locale={locale} messages={toMessages(messages)} timeZone="UTC">
      {node}
    </NextIntlClientProvider>
  );
  describe(`${locale}: chart snapshot consistency`, () => {
    it('renders every pillar, element percentage, strength value and professional field from the chart', () => {
      const { container } = render(wrap(<ChartPreview chart={baziFixture} professional />));
      for (const key of PILLAR_KEYS) {
        const pillar = baziFixture.pillars[key];
        if (!pillar) throw new Error('Fixture must have hour');
        const card = container.querySelector(`[data-chart-path="pillars.${key}"]`)!;
        expect(card.querySelector('[data-stem]')?.textContent).toBe(
          messages[`bazi.stems.${pillar.stem}`],
        );
        expect(card.querySelector('[data-branch]')?.textContent).toBe(
          messages[`bazi.branches.${pillar.branch}`],
        );
        expect(card.querySelector<HTMLElement>('[data-stem]')?.style.color).toBe(
          `var(--wu-${pillar.stemElement})`,
        );
        for (const [row, value] of [
          ['tenGod', messages[`bazi.tenGods.${pillar.tenGod}`]],
          ['naYin', messages[`bazi.naYin.${pillar.naYin}`]],
          ['lifeStage', messages[`bazi.lifeStages.${pillar.lifeStage}`]],
          ['void', messages[pillar.isVoid ? 'bazi.chart.isVoid' : 'bazi.chart.notVoid']],
        ]) {
          expect(
            container.querySelector(`[data-field="${row}"] [data-pillar="${key}"]`)?.textContent,
          ).toBe(value);
        }
        const hidden = container.querySelector(
          `[data-field="hiddenStems"] [data-pillar="${key}"]`,
        )!;
        for (const item of pillar.hiddenStems) {
          expect(hidden.textContent).toContain(messages[`bazi.stems.${item.stem}`]);
          expect(hidden.textContent).toContain(messages[`bazi.tenGods.${item.tenGod}`]);
          expect(hidden.textContent).toContain(messages[`bazi.chart.${item.role}`]);
        }
        const markers = container.querySelector(`[data-field="shenSha"] [data-pillar="${key}"]`)!;
        for (const hit of baziFixture.shenSha.filter((hit) => hit.hitsPillar.includes(key)))
          expect(markers.textContent).toContain(messages[`bazi.shenSha.${hit.name}`]);
      }
      const total = Object.values(baziFixture.elements.pct).reduce((a, b) => a + b, 0);
      let arcLength = 0;
      for (const element of Object.values(Element)) {
        const circle = container.querySelector(`[data-element="${element}"]`)!;
        expect(Number(circle.getAttribute('data-pct'))).toBe(baziFixture.elements.pct[element]);
        const length = Number(circle.getAttribute('stroke-dasharray')?.split(' ')[0]);
        expect(length).toBeCloseTo((baziFixture.elements.pct[element] / total) * 100);
        arcLength += length;
      }
      expect(arcLength).toBeCloseTo(100);
      const gauge = screen.getByRole('meter');
      expect(gauge.getAttribute('aria-valuemin')).toBe('-6');
      expect(gauge.getAttribute('aria-valuemax')).toBe('6');
      expect(Number(gauge.getAttribute('data-score'))).toBe(baziFixture.strength.score);
      expect(gauge.getAttribute('aria-valuetext')).toContain(baziFixture.strength.score.toFixed(1));
      expect(container.querySelectorAll('[data-period]')).toHaveLength(10);
      expect(container.querySelectorAll('[data-relation-index]')).toHaveLength(
        baziFixture.relations.branches.length,
      );
    });
    it('keeps unknown hour blank in both views, and preserves an out-of-range score', () => {
      const chart: BaziChart = {
        ...baziFixture,
        pillars: { ...baziFixture.pillars, hour: null },
        strength: { ...baziFixture.strength, score: -9 },
      };
      const { container } = render(wrap(<ChartPreview chart={chart} professional />));
      expect(container.querySelector('[data-chart-path="pillars.hour"]')?.textContent).toContain(
        messages['common.unknown'],
      );
      expect(container.querySelector('[data-chart-path="pillars.hour"] [data-stem]')).toBeNull();
      for (const cell of container.querySelectorAll('.bazi-full-table [data-pillar="hour"]'))
        expect(cell.textContent).toBe(messages['common.unknown']);
      expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('-6');
      expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toContain('-9.0');
    });
    it('opens every period, displays exactly its available annual records, and can close evidence-selected periods', () => {
      const { container, rerender } = render(wrap(<LuckTimeline chart={baziFixture} />));
      for (const period of baziFixture.luck.periods) {
        const button = container.querySelector<HTMLButtonElement>(
          `[data-period="${period.index}"]`,
        )!;
        fireEvent.click(button);
        expect(button.getAttribute('aria-expanded')).toBe('true');
        const expected = baziFixture.years.filter(
          (year) => year.year >= period.fromYear && year.year <= period.toYear,
        );
        expect(
          Array.from(container.querySelectorAll('[data-year]')).map((node) =>
            Number(node.getAttribute('data-year')),
          ),
        ).toEqual(expected.map((year) => year.year));
        if (!expected.length) expect(screen.getByText(messages['bazi.chart.noYears'])).toBeTruthy();
        fireEvent.click(button);
        expect(button.getAttribute('aria-expanded')).toBe('false');
      }
      rerender(wrap(<LuckTimeline chart={baziFixture} highlight="luck.periods[2].tenGod" />));
      const evidencePeriod = container.querySelector<HTMLButtonElement>('[data-period="3"]')!;
      expect(evidencePeriod.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(evidencePeriod);
      expect(evidencePeriod.getAttribute('aria-expanded')).toBe('false');
    });
    it('dispatches chart_ref to its component without duplicating the chart-root anchor', () => {
      const reading = baziReading(locale);
      const { container } = render(
        wrap(
          <ReportSection
            section={reading.report.sections.find((s) => s.key === 'elements')!}
            chart={baziFixture}
            onEvidence={vi.fn()}
          />,
        ),
      );
      expect(container.querySelector('.bazi-ring')).toBeTruthy();
      expect(container.querySelector('.bazi-pillars')).toBeNull();
      expect(container.querySelector('#chart-root')).toBeNull();
    });
    it('connects chart selection to chapter focus, evidence to chart focus, and professional toggle to full data', () => {
      const { container } = render(wrap(<ReportLayout reading={baziReading(locale)} local />));
      const root = container.querySelector('#chart-root')!;
      fireEvent.click(root.querySelector('[data-chart-path="pillars.day"]')!);
      expect(document.activeElement?.id).toBe('section-day_master');
      expect(
        root.querySelector('[data-chart-path="pillars.day"]')?.getAttribute('aria-pressed'),
      ).toBe('true');
      fireEvent.click(container.querySelector('#section-elements .evidence-tags button')!);
      expect(document.activeElement?.getAttribute('data-chart-path')).toBe('elements.pct.wood');
      expect(
        root.querySelector('[data-chart-path="elements.pct.wood"]')?.getAttribute('aria-pressed'),
      ).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: messages['report.proView'] }));
      expect(container.querySelector('.bazi-full-table')).toBeTruthy();
      expect(container.querySelectorAll('#chart-root')).toHaveLength(1);
    });
  });
}
it('draws complete three-way combinations and distinct repeated branches, with keyboard selection', () => {
  const onSelect = vi.fn();
  const chart: BaziChart = {
    ...baziFixture,
    relations: {
      stems: [],
      branches: [
        {
          type: 'tri_combine',
          pillars: ['year', 'month', 'day'],
          branches: ['yin', 'wu', 'xu'],
          complete: true,
        },
        { type: 'punish', pillars: ['day', 'hour'], branches: ['chen', 'chen'], complete: true },
      ],
    },
  };
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)}>
      <BranchRelationDiagram chart={chart} onSelect={onSelect} />
    </NextIntlClientProvider>,
  );
  expect(
    container.querySelector('[data-relation-index="0"]')?.querySelectorAll('line'),
  ).toHaveLength(3);
  expect(
    container.querySelector('[data-relation-index="1"]')?.querySelectorAll('line'),
  ).toHaveLength(1);
  fireEvent.keyDown(container.querySelector('[data-branch-node="day"]')!, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith('pillars.day.branch');
});
it('normalizes evidence paths and maps selected fields to the documented chapters', () => {
  expect(chartPath('bazi.years[10].tenGod')).toBe('years.10.tenGod');
  expect(isHighlighted('pillars.day.stem', 'pillars.day')).toBe(true);
  expect(isHighlighted('years.10', 'years.1')).toBe(false);
  expect(baziSection('bazi.years[10].tenGod')).toBe('luck_timeline');
  expect(baziSection('relations.branches[0]')).toBe('shensha_notes');
  expect(resolveChartPaths(baziFixture, 'bazi.years[isCurrent=true].tenGod')).toEqual([
    `years.${baziFixture.years.findIndex((year) => year.isCurrent)}.tenGod`,
  ]);
  expect(resolveChartPaths(baziFixture, 'luck.periods[isCurrent=true].tenGod')).toEqual([
    `luck.periods.${baziFixture.luck.periods.findIndex((period) => period.isCurrent)}.tenGod`,
  ]);
  expect(resolveChartPaths(baziFixture, 'pillars.*.tenGod')).toEqual(
    PILLAR_KEYS.map((key) => `pillars.${key}.tenGod`),
  );
});
