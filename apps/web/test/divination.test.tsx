// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import { castClock, computeDivination, computeDivinationResult } from '../lib/divination';
import { DivinationChart } from '../components/charts/divination-chart';
import { NumberPad } from '../components/forms/number-pad';
import type { ReadingRequest } from '../lib/reading-schema';
import { computeIching } from '@tianji/engine/iching';
import { computeQimen } from '@tianji/engine/qimen';
const at = '2026-10-04T15:30:00+08:00[Asia/Shanghai]';
const base: ReadingRequest = {
  system: 'iching',
  locale: 'zh',
  category: 'career',
  seed: 't35-stable-seed',
  idempotencyKey: '9da8343c-403c-4700-8ba3-467a6685f0a4',
};
afterEach(cleanup);
describe('casting boundary', () => {
  it('rejects DST gaps/overlaps and preserves the IANA zone', () => {
    expect(() => castClock('2026-03-08T02:30', 'America/New_York')).toThrow();
    expect(() => castClock('2026-11-01T01:30', 'America/New_York')).toThrow();
    expect(castClock('2026-10-04T15:30', 'Asia/Shanghai')).toBe(at);
  });
  for (const method of ['time', 'numbers', 'random'] as const)
    it(`preserves ${method} input and matches the pure engine`, () => {
      const meihua = {
        castBy: method,
        at,
        ...(method === 'numbers' ? { numbers: [3, 5, 1] } : {}),
      };
      const req: ReadingRequest = {
        ...base,
        method: 'meihua',
        question: { text: 'private', meihua },
      };
      expect(computeDivination(req)).toEqual(
        computeIching({
          method: 'meihua',
          category: 'career',
          question: 'private',
          seed: base.seed!,
          meihua,
        }),
      );
    });
  it('uses the same coin sequence and civil clock on retries and persisted reports', () => {
    const req = { ...base, method: 'liuyao', question: { at } };
    const chart = computeDivination(req);
    expect(chart).toEqual(computeDivination(req));
    expect(chart).toEqual(
      computeIching({ method: 'liuyao', category: 'career', seed: base.seed! }, at),
    );
    expect(computeDivinationResult(req).meta.schoolUsed).toMatchObject({ naJia: 'jingfang' });
  });
  it('passes the explicit Qimen clock, category and fixed school to the engine', () => {
    const options = {
      school: {
        layout: 'rotating' as const,
        juMethod: 'chaibu' as const,
        centerLodge: 'kun2' as const,
        useApparentSolarTime: false,
      },
    };
    const req: ReadingRequest = {
      ...base,
      system: 'qimen',
      category: 'wealth',
      options,
      question: { at },
    };
    expect(computeDivination(req)).toEqual(computeQimen({ at, category: 'wealth', options }));
  });
});
for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const)
  describe(`charts ${locale}`, () => {
    const show = (node: React.ReactNode) =>
      render(
        <NextIntlClientProvider locale={locale} messages={toMessages(catalog)} timeZone="UTC">
          {node}
        </NextIntlClientProvider>,
      );
    it('shows the body/use table or complete six-line installation', () => {
      const chart = computeDivination({
        ...base,
        method: 'meihua',
        question: { meihua: { at, castBy: 'numbers', numbers: [3, 5, 1] } },
      });
      show(<DivinationChart chart={chart} />);
      expect(screen.getByTestId('body-use')).toBeTruthy();
      cleanup();
      show(
        <DivinationChart
          chart={computeDivination({ ...base, method: 'liuyao', question: { at } })}
        />,
      );
      expect(screen.getByTestId('liuyao-table').querySelectorAll('tbody tr')).toHaveLength(6);
    });
    it('renders nine palaces, highlights real indicators and rotates Lo Shu with the compass', () => {
      const chart = computeDivination({
        ...base,
        system: 'qimen',
        category: 'wealth',
        question: { at },
      });
      show(<DivinationChart chart={chart} />);
      expect(document.querySelectorAll('.qimen-palace')).toHaveLength(9);
      expect(document.querySelector('.qimen-palace')?.id).toBe('chart-palace-4');
      expect(document.querySelectorAll('.use-god-palace').length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: catalog['divination.southUp'] }));
      expect(document.querySelector('.qimen-palace')?.id).toBe('chart-palace-6');
      expect(document.querySelectorAll('.qimen-compass svg text')).toHaveLength(8);
    });
    it('allows a third number without requiring it and uses accessible keypad controls', () => {
      let values = ['3', '5', ''];
      show(
        <NumberPad
          values={values}
          onChange={(next) => {
            values = next;
          }}
        />,
      );
      fireEvent.focus(screen.getByLabelText(catalog['divination.number'].replace('{number}', '3')));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
      expect(values).toEqual(['3', '5', '9']);
    });
  });
