import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { usePreferences } from '../lib/preferences';
import { fixtureReport } from '../lib/diagnostics/fixture';
import { bundledKnowledge } from '../lib/knowledge/bundled';
import { ReportSection } from '../components/report/report-section';
import { DataTree } from '../components/report/report-ui';
import { ReportParagraph } from '../components/report/report-paragraph';
import * as Clipboard from 'expo-clipboard';
const glossary = bundledKnowledge().glossary;
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
});
test('term markers open bilingual explanations and long press copies readable prose', async () => {
  const entry = glossary.find((g) => g.key === 'day_master')!;
  render(<ReportParagraph id="prose" text="我的[[term:day_master]]" glossary={glossary} />);
  fireEvent.press(screen.getByTestId('term-day_master'));
  expect(screen.getByTestId('term-detail')).toBeTruthy();
  expect(screen.getByText(`${entry.zh.term} · ${entry.en.term}`)).toBeTruthy();
  expect(screen.getByText(entry.zh.short)).toBeTruthy();
  fireEvent.press(screen.getByTestId('report-sheet-close'));
  expect(screen.queryByTestId('term-detail')).toBeNull();
  fireEvent(screen.getByTestId('prose'), 'longPress');
  await waitFor(() => expect(screen.getByTestId('paragraph-copied')).toBeTruthy());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('我的日主');
});
test('chapters fold, evidence callbacks retain exact paths, and votes await durable storage', async () => {
  const report = fixtureReport('bazi', 'zh').report;
  const section = report.sections.find((s) => s.blocks.some((b) => b.type === 'evidence'))!;
  const toggle = jest.fn(),
    evidence = jest.fn(),
    vote = jest.fn(async () => undefined);
  const props = { section, glossary, toggle, onEvidence: evidence, onVote: vote };
  const view = render(<ReportSection {...props} open />);
  const block = section.blocks.find((b) => b.type === 'evidence')!;
  if (block.type !== 'evidence') throw new Error('fixture');
  fireEvent.press(screen.getAllByTestId(`evidence-${section.key}-0`)[0]!);
  expect(evidence).toHaveBeenCalledWith(block.items[0]!.path);
  fireEvent.press(screen.getByTestId(`feedback-yes-${section.key}`));
  await waitFor(() => expect(vote).toHaveBeenCalledWith(true));
  view.rerender(<ReportSection {...props} open vote />);
  expect(screen.getByText('感谢你的反馈')).toBeTruthy();
  fireEvent.press(screen.getByTestId(`section-toggle-${section.key}`));
  expect(toggle).toHaveBeenCalledTimes(1);
  view.rerender(<ReportSection {...props} open={false} />);
  expect(screen.queryByTestId(`feedback-yes-${section.key}`)).toBeNull();
});
test('English sources and error feedback remain translated and show a failed save honestly', async () => {
  usePreferences.setState({ locale: 'en' });
  const section = {
    key: 'overview',
    title: 'Overview',
    lead: 'A clear conclusion.',
    blocks: [
      { type: 'sources' as const, items: [{ text: 'An original passage.', from: 'A source' }] },
    ],
  };
  render(
    <ReportSection
      section={section}
      open
      toggle={jest.fn()}
      glossary={glossary}
      onEvidence={jest.fn()}
      onVote={async () => {
        throw new Error('offline disk');
      }}
    />,
  );
  expect(screen.queryByText('An original passage.')).toBeNull();
  fireEvent.press(screen.getByTestId('sources-overview'));
  expect(screen.getByText('An original passage.')).toBeTruthy();
  fireEvent.press(screen.getByTestId('feedback-no-overview'));
  await waitFor(() =>
    expect(
      screen.getByText('Local data could not be read or saved. Please try again.'),
    ).toBeTruthy(),
  );
  expect(screen.queryByText('Thank you for your feedback')).toBeNull();
});

test('technical values pass through next-intl without losing the content interpolation', () => {
  render(<DataTree value={{ score: 3, available: false }} />);
  expect(screen.getByText('score: 3')).toBeTruthy();
  expect(screen.getByText('available: 未启用')).toBeTruthy();
});
