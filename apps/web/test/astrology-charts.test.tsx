// @vitest-environment jsdom
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { Planet } from '@tianji/shared';
import { computeAstrology, computeVedic } from '@tianji/engine/astrology';
import { normalizeBirth as normalize } from '@tianji/engine/common';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import E from '../../../packages/engine/test/fixtures/birth/E.json';
import { BirthInputSchema } from '@tianji/shared';
import { NatalWheel } from '../components/charts/natal-wheel';
import { VedicSouthChart } from '../components/charts/vedic-south-chart';
import { VedicNorthChart } from '../components/charts/vedic-north-chart';
import { NakshatraCard } from '../components/charts/nakshatra-card';
import { DashaTimeline } from '../components/charts/dasha-timeline';
import { PlanetTable } from '../components/charts/planet-table';
import { AspectTable } from '../components/charts/aspect-table';
import { AstrologyReportChart } from '../components/charts/astrology-report-chart';
import { VedicReportChart } from '../components/charts/vedic-report-chart';
import {
  aspectColor,
  bodyFromEvidence,
  houseFromEvidence,
  spreadLongitudes,
  wheelPoint,
  wrap,
} from '../components/charts/astro-geometry';
import { vedicDivision, SOUTH_CELLS } from '../components/charts/vedic-geometry';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
const birth = normalize(BirthInputSchema.parse(A), 'en');
const noon = normalize(BirthInputSchema.parse(E), 'en');
const now = '2026-10-04T12:00:00Z';
const astro = computeAstrology(birth),
  vedic = computeVedic(birth, now);
vi.mock('next/dynamic', () => ({ default: () => () => <div data-natal-wheel-3d /> }));
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
// Keep normalization imported from the browser-safe common entry; no server or network dependency.

it('separates circular clusters and identical longitudes by seven degrees while retaining true positions', () => {
  const inputs = [
    [359, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    Array<number>(13).fill(20),
    [1, 23, 45, 80, 101, 130, 150, 187, 211, 250, 280, 310, 350],
  ];
  for (const longitudes of inputs) {
    const bodies = Object.values(Planet).map((key, i) => ({ key, lon: longitudes[i]! }));
    const result = spreadLongitudes(bodies);
    expect(result.map((b) => b.lon).sort((a, b) => a - b)).toEqual(
      [...longitudes].sort((a, b) => a - b),
    );
    const display = result.map((b) => b.displayLon).sort((a, b) => a - b);
    for (let i = 0; i < display.length; i++)
      expect(wrap(display[(i + 1) % display.length]! - display[i]!)).toBeGreaterThanOrEqual(
        7 - 1e-6,
      );
    expect(spreadLongitudes(bodies)).toEqual(result);
  }
  expect(wheelPoint(100, 100, 100).x).toBeCloseTo(100);
  expect(wheelPoint(100, 100, 100).y).toBeCloseTo(200);
  expect(wheelPoint(190, 100, 100).y).toBeCloseTo(300);
});
it('maps documented aspects to blue, red and green semantic colors', () => {
  expect(aspectColor('conjunction')).toBe('var(--success)');
  expect(aspectColor('trine')).toBe(aspectColor('sextile'));
  expect(aspectColor('square')).toBe(aspectColor('opposition'));
});
it('keeps D1/D9 and fixed house/sign topology accurate', () => {
  expect(SOUTH_CELLS[0]).toEqual([1, 0]);
  const d9 = vedicDivision(vedic, 'D9');
  expect(d9.lagna).toBe(vedic.lagna?.navamsaSign);
  for (const body of d9.bodies) {
    expect(body.sign).toBe(body.navamsaSign);
    expect(body.degree).toBeCloseTo((body.sidLon * 9) % 30);
  }
});
for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const) {
  const provider = (child: React.ReactNode) => (
    <NextIntlClientProvider locale={locale} messages={toMessages(catalog)} timeZone="UTC">
      {child}
    </NextIntlClientProvider>
  );
  it(`${locale}: accessible SVG keyboard selection, aspect highlighting and table evidence`, () => {
    const select = vi.fn();
    const { container, rerender } = render(
      provider(<NatalWheel chart={astro} onSelect={select} />),
    );
    const sun = container.querySelector('[data-body="sun"]')!;
    fireEvent.focus(sun);
    fireEvent.keyDown(sun, { key: 'Enter' });
    expect(select).toHaveBeenCalledWith('big_three', 'bodies.0');
    expect(container.querySelector('[data-aspect][data-active="true"]')).toBeTruthy();
    rerender(
      provider(
        <>
          <PlanetTable chart={astro} highlight="bodies.0.sign" onSelect={select} />
          <AspectTable chart={astro} highlight="bodies.0.sign" onSelect={select} />
        </>,
      ),
    );
    expect(container.querySelector('.planet-table tr.chart-highlight [data-body]')).toBeNull();
    expect(
      container.querySelector('.planet-table tr.chart-highlight')?.getAttribute('data-body'),
    ).toBe('sun');
    expect(screen.getAllByText(catalog['charts.planet.sun']).length).toBeGreaterThan(0);
  });
  it(`${locale}: true divisions, north orientation, Nakshatra link and expanded Antardasha`, () => {
    const select = vi.fn();
    const { container } = render(
      provider(
        <>
          <VedicSouthChart chart={vedic} onSelect={select} />
          <VedicNorthChart chart={vedic} />
          <NakshatraCard chart={vedic} onSelect={select} />
          <DashaTimeline chart={vedic} nowISO={now} onSelect={select} />
        </>,
      ),
    );
    expect(container.querySelector('[data-lagna]')?.getAttribute('data-lagna')).toBe(
      vedic.lagna?.sign,
    );
    expect(container.querySelector('[data-house="1"]')?.getAttribute('data-sign')).toBe(
      vedic.lagna?.sign,
    );
    fireEvent.click(
      screen.getByRole('button', { name: catalog[`charts.nakshatra.${vedic.moon.nakshatra}`] }),
    );
    expect(select).toHaveBeenCalledWith('moon_nakshatra', 'moon.nakshatra');
    const segment = container.querySelector('.dasha-track button')!;
    fireEvent.click(segment);
    expect(segment.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('.antar-table tbody tr')).toHaveLength(9);
    expect(container.querySelector('.dasha-pointer')).toBeTruthy();
  });
  it(`${locale}: noon chart has no axes, houses, Lagna or current-period pointer`, () => {
    const a = computeAstrology(noon),
      v = computeVedic(noon, now);
    const { container } = render(
      provider(
        <>
          <AstrologyReportChart chart={a} />
          <VedicReportChart chart={v} nowISO={now} />
          <PlanetTable chart={v} />
        </>,
      ),
    );
    expect(container.querySelector('[data-house]')).toBeNull();
    expect(container.querySelector('[data-lagna]')).toBeNull();
    expect(container.querySelector('.axis-label')).toBeNull();
    expect(container.querySelector('.dasha-pointer')).toBeNull();
    expect(container.querySelector('[aria-current="date"]')).toBeNull();
    expect(screen.getByLabelText(catalog['form.birth.houseSystem']).hasAttribute('disabled')).toBe(
      true,
    );
  });
}
it('uses SVG fallback for reduced motion without mounting the deferred lazy 3D renderer', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)}>
      <AstrologyReportChart chart={astro} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '3D mode' }));
  expect(screen.getByText(en['charts.natal.threeFallback'])).toBeTruthy();
  expect(container.querySelector('[data-natal-wheel-3d]')).toBeNull();
  expect(container.querySelector('.natal-wheel')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('mounts the lazy 3D renderer only after an explicit supported-device toggle and keeps SVG available', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const context = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ getExtension: () => null } as unknown as WebGL2RenderingContext);
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)}>
      <AstrologyReportChart chart={astro} />
    </NextIntlClientProvider>,
  );
  expect(container.querySelector('[data-natal-wheel-3d]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '3D mode' }));
  await waitFor(() => expect(container.querySelector('[data-natal-wheel-3d]')).toBeTruthy());
  expect(container.querySelector('.natal-wheel')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '3D mode' }));
  expect(container.querySelector('[data-natal-wheel-3d]')).toBeNull();
  context.mockRestore();
  vi.unstubAllGlobals();
});

it('resolves the real knowledge corpus selectors for body and house evidence', () => {
  expect(bodyFromEvidence(astro.bodies, 'bodies[key=sun].sign')).toBe('sun');
  expect(bodyFromEvidence(vedic.bodies, 'bodies[key="chandra"].dignity')).toBe('chandra');
  expect(houseFromEvidence(astro.houses ?? [], 'houses[index=10].ruler')).toBe(9);
  expect(houseFromEvidence(astro.houses ?? [], 'houses.10.cusp')).toBe(10);
});
