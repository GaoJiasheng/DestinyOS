// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi, describe } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { toMessages } from '../i18n/catalog';
import type { Report } from '@tianji/interpret';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import {
  chartTitleKey,
  formatClock,
  hasScoreSpread,
  isDivination,
  FOLD_PREFERENCE_KEY,
} from '../components/report/report-utils';
import { ReportHeadline } from '../components/report/report-headline';
import { SectionFoldToggle } from '../components/report/section-fold-toggle';

const share = vi.hoisted(() => ({
  createShareLinkAction: vi.fn(),
  signDailyCardAction: vi.fn(),
  revokeShareLinkAction: vi.fn(),
}));
vi.mock('../app/share/actions', () => share);
vi.mock('../i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
}));
import { ShareDialog } from '../components/share/share-dialog';

const wrap = (node: React.ReactNode, catalog: Record<string, string> = zh) =>
  render(
    <NextIntlClientProvider locale="zh" messages={toMessages(catalog)} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
beforeEach(() => window.sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('report helpers', () => {
  it('zero-pads birth clock times', () => {
    expect(formatClock(9, 5)).toBe('09:05');
    expect(formatClock(23, 59)).toBe('23:59');
    expect(formatClock(undefined, undefined)).toBe('00:00');
  });
  it('detects score spread and divination systems', () => {
    const flat = { career: 3, wealth: 3, love: 3, health: 3, social: 3 } as const;
    expect(hasScoreSpread(flat)).toBe(false);
    expect(hasScoreSpread({ ...flat, love: 4 })).toBe(true);
    expect(['tarot', 'iching', 'qimen'].every(isDivination)).toBe(true);
    expect(isDivination('bazi')).toBe(false);
    expect(chartTitleKey('tarot')).toBe('report.chartTitle.tarot');
    expect(chartTitleKey('bazi')).toBe('report.chart');
  });
});

describe('ReportHeadline', () => {
  const headline: Report['headline'] = {
    persona: 'Persona',
    keywords: ['a'],
    scores: { career: 3, wealth: 3, love: 3, health: 3, social: 3 },
    confidence: 1,
  };
  it('hides the radar when all five scores are equal but keeps confidence for natal charts', () => {
    wrap(<ReportHeadline system="bazi" headline={headline} />);
    expect(screen.queryByRole('img', { name: zh['report.radar'] })).toBeNull();
    expect(screen.getByText('置信度 100%')).toBeTruthy();
    expect(screen.getByText(zh['report.summary'])).toBeTruthy();
  });
  it('draws the radar when scores differ', () => {
    wrap(
      <ReportHeadline
        system="bazi"
        headline={{ ...headline, scores: { ...headline.scores, love: 5 } }}
      />,
    );
    expect(screen.getByRole('img', { name: zh['report.radar'] })).toBeTruthy();
  });
  it('drops natal-only scores, confidence and profile wording for tarot', () => {
    wrap(
      <ReportHeadline
        system="tarot"
        headline={{ ...headline, scores: { ...headline.scores, love: 5 } }}
      />,
    );
    expect(screen.queryByRole('img', { name: zh['report.radar'] })).toBeNull();
    expect(screen.queryByText('置信度 100%')).toBeNull();
    expect(screen.queryByText(zh['report.summary'])).toBeNull();
    expect(screen.getByText(zh['report.readingSummary'])).toBeTruthy();
  });
});

describe('SectionFoldToggle', () => {
  const sections = () => (
    <>
      <details className="section-fold">
        <summary>a</summary>
      </details>
      <details className="section-fold">
        <summary>b</summary>
      </details>
    </>
  );
  it('opens and closes every section and remembers the choice for the session', () => {
    wrap(
      <>
        <SectionFoldToggle />
        {sections()}
      </>,
    );
    const folds = () => Array.from(document.querySelectorAll('details'));
    fireEvent.click(screen.getByRole('button', { name: zh['report.folds.expandAll'] }));
    expect(folds().every((d) => d.open)).toBe(true);
    expect(window.sessionStorage.getItem(FOLD_PREFERENCE_KEY)).toBe('open');
    fireEvent.click(screen.getByRole('button', { name: zh['report.folds.collapseAll'] }));
    expect(folds().some((d) => d.open)).toBe(false);
    expect(window.sessionStorage.getItem(FOLD_PREFERENCE_KEY)).toBe('closed');
  });
  it('applies a remembered "expand all" to the next report', () => {
    window.sessionStorage.setItem(FOLD_PREFERENCE_KEY, 'open');
    wrap(
      <>
        {sections()}
        <SectionFoldToggle />
      </>,
    );
    expect(Array.from(document.querySelectorAll('details')).every((d) => d.open)).toBe(true);
    expect(screen.getByRole('button', { name: zh['report.folds.collapseAll'] })).toBeTruthy();
  });
});

describe('ShareDialog', () => {
  it('still offers the link when the preview image fails, with a preview-specific error', async () => {
    share.createShareLinkAction.mockResolvedValue({ ok: true, data: { token: 'tok' } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    wrap(<ShareDialog readingId="r1" system="bazi" />, en);
    fireEvent.click(screen.getByRole('button', { name: en['report.share'] }));
    fireEvent.click(await screen.findByRole('button', { name: en['share.generate'] }));
    const link = (await screen.findByRole('textbox', {
      name: en['report.shareLink'],
    })) as HTMLInputElement;
    expect(link.value).toContain('/s/tok');
    expect(await screen.findByText(en['report.sharePreviewFailed'])).toBeTruthy();
    expect(screen.getByRole('button', { name: en['share.copy'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: en['share.revoke'] })).toBeTruthy();
    expect(screen.queryByAltText(en['share.preview'])).toBeNull();
  });
  it('reports a failed share creation separately and revokes on request', async () => {
    share.createShareLinkAction.mockResolvedValueOnce({
      ok: false,
      error: { code: 'E_INTERNAL' },
    });
    wrap(<ShareDialog readingId="r1" system="bazi" />, en);
    fireEvent.click(screen.getByRole('button', { name: en['report.share'] }));
    fireEvent.click(await screen.findByRole('button', { name: en['share.generate'] }));
    expect(await screen.findByText(en['report.shareCreateFailed'])).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: en['report.shareLink'] })).toBeNull();

    share.createShareLinkAction.mockResolvedValueOnce({ ok: true, data: { token: 'tok' } });
    share.revokeShareLinkAction.mockResolvedValueOnce({ ok: true, data: {} });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    fireEvent.click(screen.getByRole('button', { name: en['share.generate'] }));
    fireEvent.click(await screen.findByRole('button', { name: en['share.revoke'] }));
    await waitFor(() => expect(share.revokeShareLinkAction).toHaveBeenCalledWith('tok'));
    expect(await screen.findByText(en['report.shareRevoked'])).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: en['report.shareLink'] })).toBeNull();
  });
});

describe('sectionPreview', () => {
  const section = (text: string, lead = '辛金，中和：主动检验') => ({
    key: 'day_master',
    title: '日主与性格底色',
    lead,
    blocks: [{ type: 'paragraph' as const, text, unitId: 'u', polarity: 'neutral' as const }],
  });
  it('quotes the first sentence without cutting ReportText markup', async () => {
    const { sectionPreview } = await import('../components/report/report-utils');
    expect(sectionPreview(section('你倾向于先确定方向，再持续推进。甲木侧重原则。'))).toBe(
      '你倾向于先确定方向，再持续推进。',
    );
    expect(
      sectionPreview(
        section('[[term:bazi.day_master]] 是 **重点。还有**，见[说明](/zh/learn)。后文'),
      ),
    ).toBe('[[term:bazi.day_master]] 是 **重点。还有**，见[说明](/zh/learn)。');
    expect(sectionPreview(section('You may prefer a clear purpose. Jia Wood emphasizes.'))).toBe(
      'You may prefer a clear purpose.',
    );
  });
  it('returns nothing when the sentence is too long, missing, or repeats the lead', async () => {
    const { sectionPreview } = await import('../components/report/report-utils');
    expect(sectionPreview(section('长'.repeat(200) + '。'))).toBe('');
    expect(sectionPreview(section('没有句号'))).toBe('');
    expect(sectionPreview(section('同一句。', '同一句。'))).toBe('');
    expect(sectionPreview({ key: 'k', title: 't', lead: 'l', blocks: [] })).toBe('');
  });
});
