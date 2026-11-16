import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, View } from 'react-native';
import { BirthForm } from '../components/birth-form';
import { Onboarding } from '../components/onboarding';
import { AskSheet } from '../components/ask-sheet';
import { ProfileScreen } from '../components/profile-screen';
import { SessionGate } from '../components/session-gate';
import { usePreferences } from '../lib/preferences';
import { useProfiles } from '../lib/profiles';
import { requestNotificationPermission } from '../lib/notifications';
import { SettingsSchema } from '../lib/data/models';
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useRouter: () => ({
      replace: mockReplace,
      push: mockPush,
      back: jest.fn(),
      canGoBack: () => false,
    }),
    useLocalSearchParams: () => mockParams,
    useNavigation: () => ({ dispatch: jest.fn() }),
    useSegments: () => ['me'],
    usePathname: () => '/me',
    Redirect: ({ href }: { href: string }) => <View testID={`redirect-${href}`} />,
  };
});
let mockParams: Record<string, string> = {};
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => undefined }));
jest.mock('../lib/profiles', () => ({
  useProfiles: jest.fn(),
  anonymousProfileLimit: 3,
  profileLimitReached: (list: unknown[]) => list.length >= 3,
  profileDisplayName: (p: { data?: { name?: string } } | null, fallback: string) =>
    p?.data?.name || fallback,
}));
jest.mock('../lib/notifications', () => ({ requestNotificationPermission: jest.fn() }));
jest.mock('../lib/cities', () => ({ loadCities: async () => [], searchCities: () => [] }));
jest.mock('../components/effects/starfield', () => ({ Starfield: () => null }));
jest.mock('../components/effects/motion', () => ({ useEffectsMotion: () => ({ active: false }) }));
jest.mock('react-native-reanimated', () => ({
  useSharedValue: () => ({ value: 0 }),
  useFrameCallback: () => undefined,
}));
jest.mock('@react-native-picker/picker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function Picker(props: object) {
    return <View {...props} />;
  }
  Picker.Item = () => null;
  return { Picker };
});
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return View;
});
const mockSave = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
  jest.mocked(useProfiles).mockReturnValue({
    profiles: [],
    active: null,
    settings: SettingsSchema.parse({}),
    loading: false,
    error: false,
    reload: jest.fn(),
    updateSettings: mockUpdate,
    save: mockSave,
    select: mockSelect,
    setDefault: jest.fn(async () => {}),
    remove: jest.fn(),
  });
  mockSave.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
});
async function enterBirth() {
  fireEvent.changeText(screen.getByTestId('birth-year'), '1990');
  fireEvent(screen.getByTestId('birth-month'), 'valueChange', 5);
  fireEvent(screen.getByTestId('birth-day'), 'valueChange', 15);
  fireEvent(screen.getByTestId('time-unknown'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('birth-submit'));
  await screen.findByTestId('birth-city');
}
it('asks for notification permission only after the reminder screen opt-in, and allows skipping', async () => {
  jest.mocked(requestNotificationPermission).mockResolvedValue(true);
  render(<Onboarding />);
  for (let step = 0; step < 3; step++) fireEvent.press(screen.getByTestId('onboarding-next'));
  expect(screen.getByTestId('onboarding-3')).toBeTruthy();
  expect(requestNotificationPermission).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('notifications-skip'));
  expect(screen.getByTestId('onboarding-4')).toBeTruthy();
  expect(requestNotificationPermission).not.toHaveBeenCalled();
});
it('walks through three screens, denial and optional profile without treating denial as failure', async () => {
  jest.mocked(requestNotificationPermission).mockResolvedValue(false);
  render(<Onboarding />);
  for (let step = 0; step < 3; step++) fireEvent.press(screen.getByTestId('onboarding-next'));
  expect(screen.getByTestId('onboarding-3')).toBeTruthy();
  fireEvent.press(screen.getByTestId('notifications-request'));
  await screen.findByTestId('notifications-denied');
  fireEvent.press(screen.getByTestId('onboarding-next'));
  fireEvent.press(screen.getByTestId('onboarding-skip'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/today'));
  expect(mockUpdate).toHaveBeenCalledWith({ onboardingVersion: 1 });
});
it('uses English next-intl messages and requests the optional profile route after permission', async () => {
  usePreferences.setState({ locale: 'en' });
  jest.mocked(requestNotificationPermission).mockResolvedValue(true);
  render(<Onboarding />);
  expect(screen.getByText('Begin with your sky')).toBeTruthy();
  for (let step = 0; step < 3; step++) fireEvent.press(screen.getByTestId('onboarding-next'));
  fireEvent.press(screen.getByTestId('notifications-request'));
  await screen.findByTestId('onboarding-fill');
  fireEvent.press(screen.getByTestId('onboarding-fill'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/me/birth'));
});
it('rejects an empty year, saves unknown-time profiles and all advanced options through encrypted repository', async () => {
  render(<BirthForm />);
  fireEvent.press(screen.getByTestId('birth-submit'));
  expect(mockSave).not.toHaveBeenCalled();
  await enterBirth();
  fireEvent.changeText(screen.getByTestId('birth-name'), 'Test profile');
  fireEvent.press(screen.getByTestId('advanced-open'));
  fireEvent(screen.getByTestId('solar-time'), 'valueChange', false);
  fireEvent(screen.getByTestId('school-zi'), 'valueChange', 'zi_split');
  fireEvent(screen.getByTestId('school-house'), 'valueChange', 'equal');
  fireEvent(screen.getByTestId('school-leap'), 'valueChange', 'as_next');
  fireEvent.press(screen.getByTestId('birth-submit'));
  await waitFor(() => expect(mockSave).toHaveBeenCalled());
  const profile = mockSave.mock.calls[0]![0] as {
    birth: { timeUnknown: boolean; hour?: number };
    options: { school: object };
    name: string;
  };
  expect(profile.birth.timeUnknown).toBe(true);
  expect(profile.birth.hour).toBeUndefined();
  expect(profile.name).toBe('Test profile');
  expect(profile.options.school).toEqual({
    useApparentSolarTime: false,
    ziHour: 'zi_split',
    houseSystem: 'equal',
    leapMonth: 'as_next',
  });
});
it('keeps the year neutral on native picker dismissal and accepts only an explicit date choice', () => {
  render(<BirthForm />);
  fireEvent.press(screen.getByTestId('birth-date-open'));
  fireEvent(screen.getByTestId('birth-date'), 'onDismiss');
  expect(screen.getByTestId('birth-year').props.value).toBe('');
  expect(screen.queryByTestId('birth-date')).toBeNull();
  fireEvent.press(screen.getByTestId('birth-date-open'));
  const date = new Date(Date.UTC(1988, 4, 10, 12));
  fireEvent(
    screen.getByTestId('birth-date'),
    'onValueChange',
    { nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } },
    date,
  );
  expect(screen.getByTestId('birth-year').props.value).toBe('1988');
  expect(screen.getByTestId('birth-month').props.selectedValue).toBe(5);
  expect(screen.getByTestId('birth-day').props.selectedValue).toBe(10);
});
it('shows save failures and keeps the editor available for retry', async () => {
  mockSave.mockRejectedValueOnce(new Error('cipher failure'));
  render(<BirthForm />);
  await enterBirth();
  fireEvent.press(screen.getByTestId('birth-submit'));
  await screen.findByTestId('birth-error');
  expect(mockReplace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('birth-submit'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
});
it('asks before locking an under-13 birth; it locks only for the user own birthday', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  render(<BirthForm />);
  fireEvent.changeText(screen.getByTestId('birth-year'), '2020');
  fireEvent(screen.getByTestId('birth-month'), 'valueChange', 5);
  fireEvent(screen.getByTestId('birth-day'), 'valueChange', 15);
  fireEvent(screen.getByTestId('time-unknown'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('birth-submit'));
  expect(mockUpdate).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]![2]!;
  // "I made a mistake" only closes the sheet: nothing is locked and the form stays on step one.
  expect(buttons[0]!.style).toBe('cancel');
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(screen.getByTestId('birth-submit')).toBeTruthy();
  fireEvent.press(screen.getByTestId('birth-submit'));
  act(() => alert.mock.calls[1]![2]![2]!.onPress!());
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ ageBlocked: true }));
  expect(mockSave).not.toHaveBeenCalled();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/age-restricted'));
  alert.mockRestore();
});
it('lets an under-13 birth continue and save once it is marked as someone else', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  render(<BirthForm />);
  fireEvent.changeText(screen.getByTestId('birth-year'), '2020');
  fireEvent(screen.getByTestId('birth-month'), 'valueChange', 5);
  fireEvent(screen.getByTestId('birth-day'), 'valueChange', 15);
  fireEvent(screen.getByTestId('time-unknown'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('birth-submit'));
  act(() => alert.mock.calls[0]![2]![1]!.onPress!());
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(screen.queryByTestId('birth-error-year')).toBeNull();
  expect(screen.getByTestId('gender-male')).toBeTruthy();
  alert.mockRestore();
});
it('routes the ask sheet and closes it without selecting a new tab', () => {
  const close = jest.fn();
  render(<AskSheet open onClose={close} />);
  fireEvent.press(screen.getByTestId('ask-liuyao'));
  expect(close).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/iching', params: { method: 'liuyao' } });
});
it('switches active profiles without rendering full birthdays', async () => {
  const profile = {
    id: 'A',
    userId: null,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    deletedAt: null,
    data: {
      name: 'Alice',
      birth: {
        calendar: 'gregorian' as const,
        year: 1990,
        month: 5,
        day: 15,
        timeUnknown: true,
        gender: 'unspecified' as const,
      },
      version: 1,
      isCurrent: true as const,
    },
  };
  const other = { ...profile, id: 'B', data: { ...profile.data, name: 'Bob' } };
  jest
    .mocked(useProfiles)
    .mockReturnValue({ ...useProfiles(), profiles: [profile, other], active: profile });
  render(<ProfileScreen />);
  expect(screen.getByTestId('profile-A')).toBeDisabled();
  fireEvent.press(screen.getByTestId('profile-B'));
  await screen.findByTestId('profile-switched');
  expect(mockSelect).toHaveBeenCalledWith('B');
  fireEvent.press(screen.getByTestId('profile-edit-B'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/me/birth', params: { id: 'B' } });
  expect(screen.queryByText('1990-05-15')).toBeNull();
});
it('protects direct form links for unfinished onboarding and persisted age blocks', () => {
  const state = useProfiles();
  render(
    <SessionGate>
      <View testID="content" />
    </SessionGate>,
  );
  expect(screen.getByTestId('redirect-/')).toBeTruthy();
  jest
    .mocked(useProfiles)
    .mockReturnValue({ ...state, settings: SettingsSchema.parse({ ageBlocked: true }) });
  screen.rerender(
    <SessionGate>
      <View testID="content" />
    </SessionGate>,
  );
  expect(screen.getByTestId('redirect-/age-restricted')).toBeTruthy();
});
