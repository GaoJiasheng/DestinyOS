// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ZiweiChartSchema } from '@tianji/shared';
import { ZiweiGrid, ZiweiTimeRequired } from '../components/charts/ziwei-grid';
import {
  connectedPalaces,
  evidencePalace,
  ZIWEI_POSITIONS,
} from '../components/charts/ziwei-geometry';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import fixture from '../../../packages/engine/test/fixtures/ziwei/A.json';
const chart = ZiweiChartSchema.parse(fixture);
vi.mock('../i18n/navigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => <a {...props} />,
}));
vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));
HTMLElement.prototype.scrollTo = vi.fn();
afterEach(cleanup);
it('places branches in traditional positions and resolves trines/opposition for every palace', () => {
  expect(
    ['si', 'wu', 'wei', 'shen'].map((b) => ZIWEI_POSITIONS[b as keyof typeof ZIWEI_POSITIONS]),
  ).toEqual([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  expect(ZIWEI_POSITIONS.yin).toEqual([0, 3]);
  expect(ZIWEI_POSITIONS.hai).toEqual([3, 3]);
  for (const p of chart.palaces) {
    const branchOrder = [
      'zi',
      'chou',
      'yin',
      'mao',
      'chen',
      'si',
      'wu',
      'wei',
      'shen',
      'you',
      'xu',
      'hai',
    ];
    const branchIndex = branchOrder.indexOf(p.branch);
    expect(new Set(connectedPalaces(chart, p.index).map((c) => c.branch))).toEqual(
      new Set([0, 4, 8, 6].map((step) => branchOrder[(branchIndex + step) % 12])),
    );
    expect(evidencePalace(chart, `palaces[${p.index}].majorStars`)).toBe(p.index);
    expect(evidencePalace(chart, `ziwei.palaces.${p.key}.majorStars`)).toBe(p.index);
  }
  expect(evidencePalace(chart, 'horoscope.yearly.mutagens')).toBe(
    chart.horoscope.yearly.palaceIndex,
  );
  expect(evidencePalace(chart, 'patterns')).toBeUndefined();
});
for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const) {
  const wrap = (highlight?: string) => (
    <NextIntlClientProvider locale={locale} messages={toMessages(catalog)} timeZone="UTC">
      <ZiweiGrid chart={chart} highlight={highlight} professional onSelect={select} />
    </NextIntlClientProvider>
  );
  const select = vi.fn();
  it(`${locale}: selection/evidence, chronological decades, natal and annual layers, technical details`, () => {
    const { container, rerender } = render(wrap());
    const board = screen.getByTestId('ziwei-board');
    expect(board.querySelectorAll('.ziwei-palace')).toHaveLength(12);
    expect(board.querySelectorAll('[data-related="true"]')).toHaveLength(4);
    expect(board.querySelectorAll('[data-current="true"]')).toHaveLength(1);
    fireEvent.click(board.querySelector('[data-palace="wealth"]')!);
    expect(select).toHaveBeenCalledWith('career_wealth');
    expect(board.querySelector('[data-palace="wealth"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    rerender(wrap('palaces[2].majorStars'));
    expect(board.querySelector('[data-palace="spouse"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    const decades = container.querySelectorAll('.ziwei-decadal-scroll button');
    expect(decades).toHaveLength(12);
    expect(decades[0]?.textContent).toContain(
      catalog['ziwei.chart.ageRange'].replace('{from}', '6').replace('{to}', '15'),
    );
    fireEvent.click(decades[3]!);
    expect(select).toHaveBeenLastCalledWith('love_family');
    expect(screen.getByRole('table', { name: catalog['ziwei.chart.table'] })).toBeTruthy();
    const natalCount = board.querySelectorAll('[data-source="birthMutagen"]').length;
    expect(container.querySelector('[data-source="yearMutagen"]')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: catalog['ziwei.chart.yearly'] }));
    expect(board.querySelectorAll('.ziwei-annual')).toHaveLength(1);
    expect(container.querySelectorAll('[data-source="yearMutagen"]').length).toBeGreaterThanOrEqual(
      4,
    );
    expect(board.querySelectorAll('[data-source="birthMutagen"]')).toHaveLength(natalCount);
    fireEvent.click(screen.getByRole('checkbox', { name: catalog['ziwei.chart.yearly'] }));
    expect(board.querySelectorAll('.ziwei-annual')).toHaveLength(0);
    expect(container.textContent).not.toContain('1990-05-15');
    expect(screen.getByText(catalog['ziwei.chart.cycles'])).toBeTruthy();
  });
  it(`${locale}: fullscreen accessible zoom and focus-managed exit`, () => {
    render(wrap());
    fireEvent.click(screen.getByRole('button', { name: catalog['ziwei.chart.expand'] }));
    const dialog = screen.getByRole('dialog');
    const slider = within(dialog).getByRole('slider', { name: catalog['ziwei.chart.zoom'] });
    fireEvent.change(slider, { target: { value: '200' } });
    expect(within(dialog).getByTestId('ziwei-board').style.width).toBe('200%');
    fireEvent.click(within(dialog).getByRole('button', { name: catalog['ziwei.chart.reset'] }));
    expect(within(dialog).getByTestId('ziwei-board').style.width).toBe('100%');
    fireEvent.click(within(dialog).getByRole('button', { name: catalog['common.close'] }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it(`${locale}: unavailable birth time offers recovery without chart data`, () => {
    render(
      <NextIntlClientProvider locale={locale} messages={toMessages(catalog)}>
        <ZiweiTimeRequired />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('status').textContent).toContain(catalog['ziwei.chart.timeRequired']);
    expect(
      screen.getByRole('link', { name: catalog['ziwei.chart.editTime'] }).getAttribute('href'),
    ).toBe('/ziwei/new');
    expect(
      screen.getByRole('link', { name: catalog['ziwei.chart.tryBazi'] }).getAttribute('href'),
    ).toBe('/bazi/new');
    expect(screen.queryByTestId('ziwei-board')).toBeNull();
  });
}
