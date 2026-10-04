// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ReportSection, AdSlot } from '../components/report/report-section';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import type { Section } from '@tianji/interpret';
vi.mock('../app/ads/actions', () => ({
  getAdPolicyAction: vi.fn(),
  recordAdImpressionAction: vi.fn(),
}));
vi.mock('../app/readings/actions', () => ({
  submitFeedbackAction: vi.fn(() => Promise.resolve({ ok: true, data: { saved: true } })),
}));
afterEach(cleanup);
for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const) {
  it(`${locale}: renders every report block safely and connects evidence to chart selection`, () => {
    const evidence = vi.fn();
    const section: Section = {
      key: 'test',
      title: 'Section',
      lead: 'Lead',
      blocks: [
        {
          type: 'paragraph',
          text: '<script>alert(1)</script> **Emphasis**',
          unitId: 'unit',
          polarity: 'neutral',
        },
        { type: 'transition', text: 'Transition' },
        {
          type: 'evidence',
          items: [{ label: 'Pillar', path: 'pillars.day', value: 'jia', anchor: 'chart-day' }],
        },
        { type: 'advice', items: ['Suggestion'] },
        { type: 'sources', items: [{ text: 'Source text', from: 'Source book' }] },
        { type: 'chart_ref', component: 'BaziPillars', props: { path: 'pillars' } },
      ],
    };
    render(
      <NextIntlClientProvider locale={locale} messages={toMessages(catalog)} timeZone="UTC">
        <ReportSection section={section} chart={{}} onEvidence={evidence} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Section' })).toBeTruthy();
    expect(screen.getByText('Emphasis').tagName).toBe('STRONG');
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('Transition')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pillar: jia' }));
    expect(evidence).toHaveBeenCalledWith('pillars.day');
    expect(screen.getByText('Suggestion')).toBeTruthy();
    fireEvent.click(screen.getByText(catalog['report.sources']));
    expect(screen.getByText('Source text')).toBeTruthy();
    expect(
      screen.getByText(catalog['report.chartRef'].replace('{component}', 'BaziPillars')),
    ).toBeTruthy();
  });
}
it('excludes reserved ad slots for pro subscribers', () => {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)}>
      <AdSlot slot="report-2-3" plan="pro" />
    </NextIntlClientProvider>,
  );
  expect(container.querySelector('[data-ad-slot]')).toBeNull();
});
