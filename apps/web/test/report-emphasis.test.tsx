// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import type { Report } from '@tianji/interpret';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import { ReportEmphasis } from '../components/report/report-emphasis';
import { orderBasis } from '../components/report/report-emphasis-order';
import { ReportHeadline } from '../components/report/report-headline';
import { PrintEmphasis } from '../components/report/print/print-emphasis';
import { fixtureEmphasis } from './fixtures/emphasis-a';

const emphasis = fixtureEmphasis();
const wrap = (node: React.ReactNode, locale: 'zh' | 'en' = 'zh') =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={toMessages(locale === 'en' ? en : zh)}
      timeZone="UTC"
    >
      {node}
    </NextIntlClientProvider>,
  );
const level = (dim: string) =>
  document.querySelector(`[data-dim="${dim}"] .emphasis-level`)?.textContent;
afterEach(cleanup);

describe('ReportEmphasis', () => {
  it('renders Fixture A as four band words with the overview and footnotes, without numbers', () => {
    const { container } = wrap(<ReportEmphasis emphasis={emphasis} />);
    expect(screen.getByRole('heading', { name: '命盘侧重' })).toBeTruthy();
    expect(screen.getByText('你的盘面侧重在事业与人际。')).toBeTruthy();
    expect([level('career'), level('wealth'), level('love'), level('social')]).toEqual([
      '有支撑',
      '多花心思',
      '平稳',
      '有支撑',
    ]);
    expect(container.querySelector('[data-dim="health"]')).toBeNull();
    expect(screen.getByRole('img', { name: '强弱示意：多花心思' })).toBeTruthy();
    expect(screen.getByText('本命盘不评估健康。')).toBeTruthy();
    expect(screen.getByText(/不代表结果。$/)).toBeTruthy();
    expect(screen.getByText('不同体系观察的角度不同。')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d|\/5/);
  });
  it('expands one dimension to its basis, positive first, and switches the toggle label', () => {
    const { container } = wrap(<ReportEmphasis emphasis={emphasis} />);
    const wealth = container.querySelector<HTMLDetailsElement>('[data-dim="wealth"] details')!;
    expect(wealth.querySelector('summary')?.textContent).toBe('查看依据');
    wealth.open = true;
    fireEvent(wealth, new Event('toggle'));
    expect(wealth.querySelector('summary')?.textContent).toBe('收起依据');
    const items = [...wealth.querySelectorAll('li')];
    expect(items.map((li) => li.getAttribute('data-direction'))).toEqual(['1', '0', '-1', '-1']);
    expect(items[0]?.textContent).toMatch(/^\+对宫福德宫的太阴化科/);
    expect(items[2]?.textContent).toMatch(/^−生年化忌落在财帛宫.*会轻松很多。$/);
    expect(wealth.textContent).toContain('主星亮度按通行表判断。');
    expect(wealth.textContent).not.toMatch(/\d/);
  });
  it('re-renders the same stored bands in English', () => {
    wrap(<ReportEmphasis emphasis={emphasis} />, 'en');
    expect(screen.getByRole('heading', { name: 'Chart emphasis' })).toBeTruthy();
    expect([level('career'), level('wealth'), level('love'), level('social')]).toEqual([
      'Supported',
      'Takes more care',
      'Steady',
      'Supported',
    ]);
    expect(document.body.textContent).not.toMatch(/\/5/);
  });
  it('skips basis entries with unknown rule ids and uses the "none" overview when top is empty', () => {
    const custom = {
      ...emphasis,
      top: [],
      dims: {
        love: {
          level: 3 as const,
          raw: 0,
          basis: [{ ruleId: 'zw.future.rule', delta: 1, params: {} }],
        },
      },
    };
    const { container } = wrap(<ReportEmphasis emphasis={custom} />);
    expect(container.querySelectorAll('.emphasis-dim')).toHaveLength(1);
    expect(container.querySelector('.emphasis-basis li')).toBeNull();
    expect(screen.getByText(zh['report.emphasis.basisEmpty'])).toBeTruthy();
    expect(container.querySelector('.emphasis-overview')?.textContent).toBeTruthy();
  });
});

describe('orderBasis', () => {
  it('lists positive, then zero, then negative entries, stable within each group', () => {
    const basis = [-1, 0.5, 0, -0.25, 1, 0].map((delta, i) => ({
      ruleId: `r${i}`,
      delta,
      params: {},
    }));
    expect(orderBasis(basis).map((b) => b.ruleId)).toEqual(['r1', 'r4', 'r2', 'r5', 'r0', 'r3']);
  });
});

describe('ReportHeadline emphasis slot', () => {
  const headline: Report['headline'] = {
    persona: 'Persona',
    keywords: ['a'],
    scores: { career: 3, wealth: 3, love: 3, health: 3, social: 3 },
    confidence: 1,
  };
  it('renders nothing for reports without emphasis', () => {
    const { container } = wrap(<ReportHeadline system="ziwei" headline={headline} />);
    expect(container.querySelector('.report-emphasis')).toBeNull();
    expect(container.textContent).not.toContain('命盘侧重');
  });
  it('lazily mounts the module when the report carries emphasis', async () => {
    const { container } = wrap(
      <ReportHeadline system="ziwei" headline={{ ...headline, emphasis }} />,
    );
    await waitFor(() => expect(container.querySelector('.report-emphasis')).not.toBeNull());
    expect(container.querySelectorAll('.emphasis-dim')).toHaveLength(4);
  });
});

describe('PrintEmphasis', () => {
  it('prints band words, at most three basis lines per dimension and the footnotes, no scores', () => {
    const { container } = wrap(<PrintEmphasis emphasis={emphasis} />);
    expect(container.querySelector('[data-print-section="emphasis"]')).not.toBeNull();
    for (const dim of ['career', 'wealth', 'love', 'social'])
      expect(container.querySelectorAll(`[data-dim="${dim}"] li`).length).toBeLessThanOrEqual(3);
    expect(container.querySelector('[data-dim="wealth"] .print-emphasis-level')?.textContent).toBe(
      '多花心思',
    );
    expect(container.textContent).toContain('你的盘面侧重在事业与人际。');
    expect(container.textContent).toContain('本命盘不评估健康。');
    expect(container.textContent).not.toMatch(/\d|\/5/);
  });
});
