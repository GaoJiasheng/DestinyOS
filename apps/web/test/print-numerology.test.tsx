import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { NumerologyChartSchema } from '@tianji/shared';
import { toMessages } from '../i18n/catalog';
import { PrintReport } from '../components/report/print/print-report';
import { baziReading } from './fixtures/bazi-reading';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import fixture from '../../../packages/content/test/fixtures/numerology.a.json';

describe('merged numerology report exports', () => {
  for (const locale of ['zh', 'en'] as const) {
    for (const withName of [true, false]) {
      it(`${locale}: prints translated numbers, digit grid and cycles with name=${withName}`, () => {
        const catalog = locale === 'zh' ? zh : en;
        const chart = NumerologyChartSchema.parse({
          ...fixture,
          nameNumbers: withName ? fixture.nameNumbers : null,
        });
        const source = baziReading(locale);
        const reading = {
          ...source,
          system: 'numerology' as const,
          chart,
          report: { ...source.report, system: 'numerology' as const },
        };
        const markup = renderToStaticMarkup(
          <NextIntlClientProvider
            locale={locale}
            timeZone="UTC"
            messages={toMessages(catalog)}
            onError={(error) => {
              throw error;
            }}
          >
            <PrintReport reading={reading} theme="light" qr="data:image/png;base64," />
          </NextIntlClientProvider>,
        );
        for (const key of [
          'numerology.lifePath',
          'numerology.grid',
          'numerology.cycles',
          'export.legend.numerology',
        ] as const)
          expect(markup).toContain(catalog[key]);
        expect(markup).toContain('2034');
        expect(markup).toContain('viewBox="0 0 680 680"');
        if (!withName) expect(markup).toContain(catalog['numerology.empty']);
        for (let i = 0; i < 6; i++) {
          const key = `report.chat.chips.numerology.${i}` as keyof typeof catalog;
          expect(catalog[key]).toBeTruthy();
        }
      });
    }
  }
});

describe('print cover score block', () => {
  const render = (scores: ReturnType<typeof baziReading>['report']['headline']['scores']) => {
    const source = baziReading('zh');
    const reading = {
      ...source,
      report: { ...source.report, headline: { ...source.report.headline, scores } },
    };
    return renderToStaticMarkup(
      <NextIntlClientProvider
        locale="zh"
        timeZone="UTC"
        messages={toMessages(zh)}
        onError={(error) => {
          throw error;
        }}
      >
        <PrintReport reading={reading} theme="light" qr="data:image/png;base64," />
      </NextIntlClientProvider>,
    );
  };
  it('omits the radar, its labels and the score marker when all five scores are identical', () => {
    const markup = render({ career: 3, wealth: 3, love: 3, health: 3, social: 3 });
    expect(markup).not.toContain('print-radar');
    expect(markup).not.toContain('/5');
    expect(markup).not.toContain('data-radar');
  });
  it('draws the radar and its labels when scores differ', () => {
    const markup = render({ career: 3, wealth: 4, love: 3, health: 3, social: 3 });
    expect(markup).toContain('print-radar');
    expect(markup).toContain('data-radar="true"');
    expect(markup).toContain('4/5');
  });
});
