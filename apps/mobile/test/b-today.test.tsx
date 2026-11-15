import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { TodayScreen } from '../components/daily/today-screen';
import { JournalEditor } from '../components/daily/journal-editor';
import { usePreferences } from '../lib/preferences';
import { loadDaily, profileJournal, todayIn, type NativeDaily } from '../lib/daily/service';
import { useDaily } from '../lib/daily/use-daily';
import { getLocalStore } from '../lib/data/store';
import { fixtureChart, fixtureReport } from '../lib/diagnostics/fixture';
import { SettingsSchema as MockSettingsSchema } from '../lib/data/models';

const mockPush = jest.fn(),
  mockShare = jest.fn();
const mockProfile = {
  id: 'a',
  userId: null,
  createdAt: '2026-10-04T00:00:00.000Z',
  updatedAt: '2026-10-04T00:00:00.000Z',
  deletedAt: null,
  data: { version: 1, name: 'Mei' },
};
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-00000000000c' }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-router/react-navigation', () => ({ useIsFocused: () => true }));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    active: mockProfile,
    profiles: [],
    loading: false,
    error: false,
    settings: MockSettingsSchema.parse({ tz: 'UTC' }),
  }),
}));
jest.mock('../lib/daily/service', () => ({
  ...jest.requireActual<object>('../lib/daily/service'),
  loadDaily: jest.fn(),
  profileJournal: jest.fn(),
  hasVedicHistory: jest.fn(async () => false),
}));
jest.mock('../lib/data/store', () => ({ getLocalStore: jest.fn() }));
jest.mock('../lib/reports/feedback', () => ({
  getFeedback: jest.fn(async () => ({})),
  saveFeedback: jest.fn(async () => undefined),
}));
jest.mock('../components/daily/sky-hero', () => ({ SkyHero: () => null }));
jest.mock('../components/daily/daily-share', () => ({
  DailyShare: () => {
    mockShare();
    return null;
  },
}));
jest.mock('../components/effects/motion', () => ({ useEffectsMotion: () => ({ active: false }) }));
jest.mock('../lib/rituals/feedback', () => ({
  useRitualFeedback: () => ({ feedback: jest.fn() }),
}));
jest.mock('../components/rituals/tarot-card', () => ({ RitualCard: () => null }));
jest.mock('../components/daily/notification-hint', () => ({ NotificationHint: () => null }));
jest.mock('../components/native-ad-card', () => ({ NativeAdCard: () => null }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView', BlurTargetView: 'BlurTargetView' }));
jest.mock('../components/daily/stars', () => ({ DailyStars: () => null }));

let value: NativeDaily;
beforeAll(() => {
  const report = fixtureReport('daily', 'zh').report;
  value = {
    id: 'daily-a',
    chart: fixtureChart('daily') as NativeDaily['chart'],
    report,
    engineVersion: report.engineVersion,
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: 'en', theme: 'auto' });
  jest.mocked(profileJournal).mockResolvedValue([]);
  jest.mocked(loadDaily).mockReset().mockResolvedValue(value);
  jest.mocked(getLocalStore).mockResolvedValue({
    saveJournal: jest.fn(),
  } as unknown as Awaited<ReturnType<typeof getLocalStore>>);
});

it('keeps the loaded day on screen while refreshing, and drops it when the day changes', async () => {
  const { result } = renderHook(() => useDaily());
  await waitFor(() => expect(result.current.value).toBe(value));
  jest.mocked(loadDaily).mockReturnValueOnce(new Promise(() => undefined));
  act(() => result.current.refresh());
  expect(result.current.busy).toBe(true);
  expect(result.current.value).toBe(value);
  act(() => result.current.setDate('2026-10-01'));
  expect(result.current.value).toBeNull();
});

it('labels dates relative to the real today and names whose fortune it is', async () => {
  const today = todayIn('UTC');
  render(<TodayScreen />);
  await screen.findByTestId('daily-now');
  expect(screen.getByTestId('daily-prev').props.accessibilityLabel).toBe('Yesterday');
  expect(screen.getByTestId('daily-now').props.accessibilityState.checked).toBe(true);
  // Title and the selected segment.
  expect(screen.getAllByText('Today')).toHaveLength(2);
  fireEvent.press(screen.getByTestId('today-profile'));
  expect(mockPush).toHaveBeenCalledWith('/me');
  expect(screen.getByTestId('today-profile').props.accessibilityLabel).toBe(
    'Mei’s fortune · Switch profile',
  );
  await waitFor(() =>
    expect(screen.getByTestId('daily-prev').props.accessibilityState.disabled).toBe(false),
  );
  fireEvent.press(screen.getByTestId('daily-prev'));
  await screen.findByTestId('daily-back-today');
  expect(screen.getByTestId('daily-prev').props.accessibilityLabel).toBe('Previous day');
  expect(screen.getByTestId('daily-next').props.accessibilityLabel).toBe('Next day');
  expect(screen.queryAllByText('Today')).toHaveLength(0);
  fireEvent.press(screen.getByTestId('daily-back-today'));
  await waitFor(() => expect(screen.queryByTestId('daily-back-today')).toBeNull());
  expect(jest.mocked(loadDaily).mock.calls.at(-1)?.[1]).toBe(today);
});

it('opens sharing from a long press only, never from a tap on the one-liner', async () => {
  render(<TodayScreen />);
  const card = await screen.findByTestId('daily-card-longpress');
  fireEvent.press(card);
  expect(mockShare).not.toHaveBeenCalled();
  fireEvent(card, 'longPress');
  expect(mockShare).toHaveBeenCalled();
});

it('restores an unsaved journal draft after the editor remounts', async () => {
  const view = render(<JournalEditor profileId="a" profileVersion={1} value={value} tz="UTC" />);
  await screen.findByTestId('journal-save');
  expect(screen.getByTestId('journal-text').props.multiline).toBe(true);
  fireEvent.press(screen.getByTestId('journal-mood-2'));
  fireEvent.changeText(screen.getByTestId('journal-text'), 'half a\nthought');
  view.unmount();
  render(<JournalEditor profileId="a" profileVersion={1} value={value} tz="UTC" />);
  await screen.findByTestId('journal-draft');
  expect(screen.getByTestId('journal-text').props.value).toBe('half a thought');
  expect(screen.getByTestId('journal-mood-2').props.accessibilityState.checked).toBe(true);
});
