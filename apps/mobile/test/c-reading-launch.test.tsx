import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import ReadingScreen from '../app/(tabs)/reading';
import { usePreferences } from '../lib/preferences';
import { createNativeReading } from '../lib/reports/readings';
import { findExistingReading } from '../lib/reports/launch';
import A from '../../../packages/engine/test/fixtures/birth/A.json';

const mockPush = jest.fn(),
  mockSetParams = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));
const mockProfile = (id: string, name: string, timeUnknown = false) => ({
  id,
  userId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  deletedAt: null,
  data: {
    name,
    birth: timeUnknown ? { ...A, timeUnknown: true, hour: undefined, minute: undefined } : A,
    version: 1,
    isCurrent: true,
  },
});
let mockProfiles = [mockProfile('me', 'Ada'), mockProfile('kid', '小明', true)];
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({ profiles: mockProfiles, active: mockProfiles[0] ?? null, loading: false }),
}));
jest.mock('../lib/reports/readings', () => ({
  createNativeReading: jest.fn(async () => ({ id: 'fresh' })),
  readingError: () => 'mobile.storage.error',
}));
jest.mock('../lib/reports/launch', () => ({
  ...jest.requireActual<typeof import('../lib/reports/launch')>('../lib/reports/launch'),
  findExistingReading: jest.fn(async () => null),
  yieldFrame: async () => undefined,
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockProfiles = [mockProfile('me', 'Ada'), mockProfile('kid', '小明', true)];
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
});

test('a repeat tap reopens the saved report instead of casting a duplicate', async () => {
  jest.mocked(findExistingReading).mockResolvedValueOnce('old');
  render(<ReadingScreen />);
  expect(screen.getByText('当前：Ada')).toBeTruthy();
  fireEvent.press(screen.getByTestId('system-bazi'));
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/[system]/r/[id]',
      params: { system: 'bazi', id: 'old', reused: '1' },
    }),
  );
  expect(createNativeReading).not.toHaveBeenCalled();
});

test('the chosen profile is used, and Zi Wei without a birth time offers to add one', async () => {
  render(<ReadingScreen />);
  fireEvent.press(screen.getByTestId('reading-profile-kid'));
  expect(screen.getByText('当前：小明')).toBeTruthy();
  expect(screen.getByText(/（需要出生时辰）$/)).toBeTruthy();
  fireEvent.press(screen.getByTestId('system-ziwei'));
  fireEvent.press(screen.getByTestId('reading-add-time'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/me/birth',
    params: { id: 'kid', system: 'ziwei', returnTo: '/reading?system=ziwei&profile=kid' },
  });
  expect(createNativeReading).not.toHaveBeenCalled();
});

test('numerology passes the Latin profile name and rejects non-Latin input', async () => {
  render(<ReadingScreen />);
  fireEvent.press(screen.getByTestId('system-numerology'));
  expect(screen.getByTestId('reading-numerology-name').props.value).toBe('Ada');
  fireEvent.changeText(screen.getByTestId('reading-numerology-name'), '王');
  fireEvent.press(screen.getByTestId('reading-numerology-start'));
  expect(screen.getByText('请输入英文姓名，或留空继续。')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('reading-numerology-name'), 'Ada King');
  fireEvent.press(screen.getByTestId('reading-numerology-start'));
  await waitFor(() =>
    expect(createNativeReading).toHaveBeenCalledWith(
      'numerology',
      mockProfiles[0],
      undefined,
      undefined,
      undefined,
      { name: 'Ada King' },
    ),
  );
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/[system]/r/[id]',
    params: { system: 'numerology', id: 'fresh' },
  });
});

test('without a profile the birth form returns here with the system to cast', async () => {
  mockProfiles = [];
  render(<ReadingScreen />);
  fireEvent.press(screen.getByTestId('system-astrology'));
  const call = mockPush.mock.calls[0]?.[0] as { pathname: string; params: Record<string, string> };
  expect(call.pathname).toBe('/me/birth');
  expect(call.params.system).toBe('astrology');
  expect(call.params.relation).toBeUndefined();
  expect(call.params.returnTo).toMatch(/^\/reading\?system=astrology&after=/);
});

test('returning from the birth form casts for the profile it saved', async () => {
  mockParams = { system: 'bazi', profile: 'kid' };
  render(<ReadingScreen />);
  await waitFor(() =>
    expect(createNativeReading).toHaveBeenCalledWith(
      'bazi',
      mockProfiles[1],
      undefined,
      undefined,
      undefined,
      undefined,
    ),
  );
  expect(mockSetParams).toHaveBeenCalled();
});
