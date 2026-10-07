import { FlatList } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TodayScreen } from '../components/daily/today-screen';
import { JournalEditor } from '../components/daily/journal-editor';
import { LearnScreen } from '../components/learn/learn-screen';
import { usePreferences } from '../lib/preferences';
import { profileJournal } from '../lib/daily/service';
import { useDaily } from '../lib/daily/use-daily';
import { getFeedback, saveFeedback } from '../lib/reports/feedback';
import { getLocalStore } from '../lib/data/store';
import { fixtureChart, fixtureReport } from '../lib/diagnostics/fixture';
import { SettingsSchema as MockSettingsSchema } from '../lib/data/models';
import type { NativeDaily } from '../lib/daily/service';
const mockPush = jest.fn(),
  mockRefresh = jest.fn(),
  mockDate = jest.fn(),
  mockSave = jest.fn();
let mockParams: { system?: string; entry?: string; slug?: string } = {};
const mockProfile = {
  id: 'a',
  userId: null,
  createdAt: '2026-10-04T00:00:00.000Z',
  updatedAt: '2026-10-04T00:00:00.000Z',
  deletedAt: null,
  data: { version: 1 },
};
let mockActive: object | null = mockProfile;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-router/react-navigation', () => ({ useIsFocused: () => true }));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    active: mockActive,
    profiles: [],
    loading: false,
    error: false,
    settings: MockSettingsSchema.parse({}),
  }),
}));
jest.mock('../lib/daily/use-daily', () => ({ useDaily: jest.fn() }));
jest.mock('../lib/daily/service', () => ({
  ...jest.requireActual<object>('../lib/daily/service'),
  loadDaily: jest.fn(),
  profileJournal: jest.fn(),
}));
jest.mock('../lib/data/store', () => ({ getLocalStore: jest.fn() }));
jest.mock('../lib/reports/feedback', () => ({
  getFeedback: jest.fn(async () => ({})),
  saveFeedback: jest.fn(async () => undefined),
}));
jest.mock('../components/daily/sky-hero', () => ({ SkyHero: () => null }));
jest.mock('../components/daily/daily-share', () => ({ DailyShare: () => null }));
jest.mock('../components/effects/motion', () => ({ useEffectsMotion: () => ({ active: false }) }));
jest.mock('../lib/rituals/feedback', () => ({
  useRitualFeedback: () => ({ feedback: jest.fn() }),
}));
jest.mock('../components/rituals/tarot-card', () => ({ RitualCard: () => null }));
jest.mock('../components/daily/notification-hint', () => ({ NotificationHint: () => null }));
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
  mockParams = {};
  mockActive = mockProfile;
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
  jest.mocked(profileJournal).mockResolvedValue([]);
  jest.mocked(getLocalStore).mockResolvedValue({
    saveJournal: mockSave,
    readings: { list: async () => [] },
  } as unknown as Awaited<ReturnType<typeof getLocalStore>>);
  jest.mocked(useDaily).mockReturnValue({
    active: mockProfile as ReturnType<typeof useDaily>['active'],
    tz: 'Asia/Shanghai',
    date: '2026-10-04',
    setDate: mockDate,
    value,
    busy: false,
    error: false,
    refresh: mockRefresh,
  });
});
it('renders all thirteen blocks, moves dates and connects pull refresh/calendar', async () => {
  render(<TodayScreen />);
  await waitFor(() => expect(getFeedback).toHaveBeenCalledWith('daily-a'));
  for (let n = 1; n <= 13; n++) expect(screen.getByTestId(`daily-block-${n}`)).toBeTruthy();
  fireEvent(screen.getByTestId('daily-block-1'), 'touchStart', {
    nativeEvent: { pageX: 300, pageY: 500 },
  });
  fireEvent(screen.getByTestId('daily-block-1'), 'touchEnd', {
    nativeEvent: { pageX: 100, pageY: 510 },
  });
  expect(mockDate).toHaveBeenCalledWith('2026-10-05');
  fireEvent(screen.getByTestId('daily-block-1'), 'touchStart', {
    nativeEvent: { pageX: 100, pageY: 500 },
  });
  fireEvent(screen.getByTestId('daily-block-1'), 'touchEnd', {
    nativeEvent: { pageX: 300, pageY: 505 },
  });
  expect(mockDate).toHaveBeenCalledWith('2026-10-03');
  fireEvent.press(screen.getByTestId('daily-prev'));
  expect(mockDate).toHaveBeenCalledWith('2026-10-03');
  fireEvent.press(screen.getByTestId('today-calendar'));
  expect(mockPush).toHaveBeenCalledWith('/today/calendar');
  fireEvent(screen.getByTestId('today-scroll'), 'refresh');
  screen.getByTestId('today-scroll').props.refreshControl.props.onRefresh();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId('daily-vote-yes'));
  await waitFor(() => expect(saveFeedback).toHaveBeenCalledWith('daily-a', 'daily', true));
});
it('gates the sample from personal feedback and exposes an English birth CTA', async () => {
  usePreferences.setState({ locale: 'en' });
  mockActive = null;
  jest.mocked(useDaily).mockReturnValue({
    ...jest.mocked(useDaily)(),
    active: null,
    value: { ...value, id: null },
  });
  render(<TodayScreen />);
  expect(screen.getByTestId('today-birth').props.accessibilityLabel).toBe(
    'Add birth information to see your fortune',
  );
  expect(getFeedback).not.toHaveBeenCalled();
});
it('shows journal save errors, retries and writes validated snapshot without losing a revision', async () => {
  mockSave.mockRejectedValueOnce(new Error('cipher')).mockResolvedValueOnce(undefined);
  render(<JournalEditor profileId="a" profileVersion={1} value={value} tz="Asia/Shanghai" />);
  await waitFor(() => expect(screen.getByTestId('journal-save')).toBeTruthy());
  fireEvent.press(screen.getByTestId('journal-mood-4'));
  fireEvent.changeText(screen.getByTestId('journal-text'), 'private sentence');
  fireEvent.press(screen.getByTestId('journal-save'));
  await waitFor(() => expect(screen.getByTestId('journal-error')).toBeTruthy());
  fireEvent.press(screen.getByTestId('journal-save'));
  await waitFor(() => expect(screen.getByTestId('journal-saved')).toBeTruthy());
  expect(mockSave.mock.calls[1]?.[0]).toMatchObject({
    profileId: 'a',
    mood: 4,
    text: 'private sentence',
    prediction: { scores: value.chart.scores },
  });
});
it('blocks future mood saves and ignores late journal loads on unmount', async () => {
  const future = {
    ...value,
    chart: { ...value.chart, date: { ...value.chart.date, local: '2100-12-31' } },
  };
  const view = render(<JournalEditor profileId="a" profileVersion={1} value={future} tz="UTC" />);
  await waitFor(() =>
    expect(screen.getByTestId('journal-save').props.accessibilityState.disabled).toBe(true),
  );
  view.unmount();
  expect(mockSave).not.toHaveBeenCalled();
});
it('browses offline 64 hexagrams, 78 cards and 27 tutorials through documented routes', () => {
  render(<LearnScreen />);
  fireEvent.press(screen.getByTestId('learn-category-hexagrams'));
  fireEvent.press(screen.getByTestId('learn-item-0'));
  expect(mockPush.mock.calls.at(-1)?.[0]).toMatch(/^\/learn\/iching\//);
  fireEvent.press(screen.getByTestId('learn-category-cards'));
  fireEvent.press(screen.getByTestId('learn-item-0'));
  expect(mockPush.mock.calls.at(-1)?.[0]).toBe('/learn/tarot/major_00_fool');
  fireEvent.changeText(screen.getByTestId('learn-search'), 'no-such-card');
  expect(screen.queryByTestId('learn-item-0')).toBeNull();
  fireEvent.press(screen.getByTestId('learn-category-tutorials'));
  expect(screen.getAllByTestId(/learn-item-/)).toHaveLength(12);
  expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(27);
});
it('renders English card meanings, classical hexagram toggle and missing content state', () => {
  usePreferences.setState({ locale: 'en' });
  mockParams = { system: 'tarot', entry: 'major_00_fool' };
  const view = render(<LearnScreen />);
  expect(screen.getByText('Upright meaning')).toBeTruthy();
  view.unmount();
  mockParams = { system: 'iching', entry: 'hexagram_01' };
  const hex = render(<LearnScreen />);
  expect(screen.getByTestId('learn-original')).toBeTruthy();
  fireEvent.press(screen.getByTestId('learn-original'));
  hex.unmount();
  mockParams = { system: 'unknown' };
  render(<LearnScreen />);
  expect(screen.getByText('Report not found.')).toBeTruthy();
});
