import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ReportScreen } from '../components/report/report-screen';
import { loadNativeReading, parseNativeChart, type NativeReading } from '../lib/reports/readings';
import { usePreferences } from '../lib/preferences';
import { normalizeBirth } from '@tianji/engine';
import { BirthInputSchema } from '@tianji/shared';
import { fixtureReport } from '../lib/diagnostics/fixture';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
  ReduceMotion: { System: 'system' },
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    profiles: [],
    loading: false,
    error: false,
    settings: { reducedMotion: false, ageBlocked: false },
  }),
}));
jest.mock('../lib/reports/readings', () => ({
  ...jest.requireActual<typeof import('../lib/reports/readings')>('../lib/reports/readings'),
  loadNativeReading: jest.fn(),
}));
jest.mock('../lib/reports/feedback', () => ({
  getFeedback: async () => ({}),
  saveFeedback: async () => undefined,
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: async () => true }));
jest.mock('../components/charts/native-chart', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    NativeChartView: ({ highlight }: { highlight: string }) => (
      <Text testID="chart-highlight">{highlight}</Text>
    ),
  };
});
jest.mock('@shopify/react-native-skia', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Canvas: View,
    Path: () => null,
    Skia: { Path: { Make: () => ({ moveTo() {}, lineTo() {}, close() {} }) } },
  };
});
function reading(): NativeReading {
  const { chart, report } = fixtureReport('bazi', 'zh');
  return {
    chart: parseNativeChart('bazi', chart),
    report,
    warnings: [],
    stale: true,
    record: {
      id: 'fixture',
      userId: null,
      createdAt: '2026-10-04T04:00:00.000Z',
      updatedAt: '2026-10-04T04:00:00.000Z',
      deletedAt: null,
      data: {
        profileId: null,
        profileVersion: null,
        system: 'bazi',
        status: 'ok',
        inputSnapshot: {
          system: 'bazi',
          birth: BirthInputSchema.parse(A),
          locale: 'zh',
          idempotencyKey: '00000000-0000-4000-8000-000000000000',
        },
        chart,
        reportZh: { ...report },
        reportEn: null,
        schoolUsed: {},
        engineVersion: report.engineVersion,
        knowledgeVersion: report.knowledgeVersion,
        interpretVersion: report.interpretVersion,
        title: null,
        isPublic: false,
      },
    },
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
});
test('loading, missing and storage failure have distinct native states with retry/back actions', async () => {
  jest.mocked(loadNativeReading).mockImplementationOnce(() => new Promise(() => undefined));
  const view = render(<ReportScreen id="loading" system="bazi" />);
  expect(screen.getByTestId('report-loading')).toBeTruthy();
  view.unmount();
  jest.mocked(loadNativeReading).mockResolvedValueOnce(null);
  const missing = render(<ReportScreen id="missing" system="bazi" />);
  await waitFor(() => expect(screen.getByTestId('report-missing')).toBeTruthy());
  missing.unmount();
  jest
    .mocked(loadNativeReading)
    .mockRejectedValueOnce(new Error('cipher'))
    .mockResolvedValueOnce(null);
  render(<ReportScreen id="broken" system="bazi" />);
  await waitFor(() => expect(screen.getByTestId('report-error')).toBeTruthy());
  fireEvent.press(screen.getByText('重试'));
  await waitFor(() => expect(screen.getByTestId('report-missing')).toBeTruthy());
});
test('report hides full birthday, exposes stale state and links chapter evidence into chart highlighting', async () => {
  const data = reading();
  jest.mocked(loadNativeReading).mockResolvedValue(data);
  render(<ReportScreen id="fixture" system="bazi" />);
  await waitFor(() => expect(screen.getByTestId('report-stale')).toBeTruthy());
  if (!data.record.data) throw new Error('fixture snapshot');
  const birth = normalizeBirth(data.record.data.inputSnapshot.birth!).local;
  const fullBirth = `${birth.year}-${birth.month}-${birth.day} · ${String(birth.hour).padStart(2, '0')}:${String(birth.minute).padStart(2, '0')} · ${birth.tz}`;
  expect(screen.queryByText(fullBirth)).toBeNull();
  fireEvent.press(screen.getByTestId('report-birth'));
  expect(screen.getByText(fullBirth)).toBeTruthy();
  fireEvent.press(screen.getByTestId('report-birth'));
  expect(screen.queryByText(fullBirth)).toBeNull();
  const evidence = data.report.sections.find((s) => s.blocks.some((b) => b.type === 'evidence'))!;
  const block = evidence.blocks.find((b) => b.type === 'evidence')!;
  if (block.type !== 'evidence') throw new Error('fixture');
  fireEvent.press(screen.getAllByTestId(`evidence-${evidence.key}-0`)[0]!);
  expect(screen.getByTestId('chart-highlight').props.children).toBe(block.items[0]!.path);
  fireEvent.press(screen.getByTestId('report-pro'));
  expect(screen.getByTestId('report-professional')).toBeTruthy();
  expect(screen.getByTestId('report-full-data')).toBeTruthy();
});

test('unknown time remains unknown when the saved birth header is expanded', async () => {
  const data = reading();
  if (!data.record.data) throw new Error('fixture snapshot');
  const input = data.record.data.inputSnapshot.birth!;
  input.timeUnknown = true;
  delete input.hour;
  delete input.minute;
  const birth = normalizeBirth(input).local;
  jest.mocked(loadNativeReading).mockResolvedValue(data);
  render(<ReportScreen id="unknown" system="bazi" />);
  await waitFor(() => expect(screen.getByTestId('report-birth')).toBeTruthy());
  fireEvent.press(screen.getByTestId('report-birth'));
  expect(
    screen.getByText(`${birth.year}-${birth.month}-${birth.day} · 我不知道出生时间 · ${birth.tz}`),
  ).toBeTruthy();
});
