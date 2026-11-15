import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BirthForm } from '../components/birth-form';
import { TimezonePicker } from '../components/timezone-picker';
import { usePreferences } from '../lib/preferences';
import { useProfiles } from '../lib/profiles';
import { SettingsSchema } from '../lib/data/models';
import { emptyBirth, stepOneIssues } from '../lib/birth-form';
import { birthDoneHref, relationParam, safeReturnTo } from '../lib/birth-route';
import { searchTimeZones } from '../lib/timezones';
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ dispatch: jest.fn() }),
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => undefined }));
jest.mock('../lib/profiles', () => ({
  useProfiles: jest.fn(),
  anonymousProfileLimit: 3,
  profileLimitReached: (list: unknown[]) => list.length >= 3,
}));
jest.mock('../lib/cities', () => ({
  loadCities: async () => [],
  searchCities: () => [],
  cityLabel: () => '',
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
const profile = (id: string) => ({
  id,
  userId: null,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
  deletedAt: null,
  data: {
    name: id,
    relation: 'self' as const,
    birth: { ...emptyBirth(), year: 1990, month: 5, day: 15, timeUnknown: true },
    version: 1,
    isCurrent: true as const,
  },
});
function mockProfiles(profiles: ReturnType<typeof profile>[] = []) {
  jest.mocked(useProfiles).mockReturnValue({
    profiles,
    active: profiles[0] ?? null,
    settings: SettingsSchema.parse({}),
    loading: false,
    error: false,
    reload: jest.fn(),
    updateSettings: jest.fn(async () => {}),
    save: mockSave,
    select: jest.fn(),
    setDefault: jest.fn(),
    remove: jest.fn(),
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
  mockSave.mockResolvedValue(undefined);
  mockProfiles();
});
async function fillDate() {
  fireEvent.changeText(screen.getByTestId('birth-year'), '1990');
  fireEvent(screen.getByTestId('birth-month'), 'valueChange', 5);
  fireEvent(screen.getByTestId('birth-day'), 'valueChange', 15);
}
it('starts empty and names every missing field only after submit', () => {
  render(<BirthForm />);
  expect(screen.getByTestId('birth-month').props.selectedValue).toBe(0);
  expect(screen.getByTestId('birth-branch').props.selectedValue).toBe(-1);
  fireEvent.changeText(screen.getByTestId('birth-year'), '1');
  expect(screen.queryByTestId('birth-error-year')).toBeNull();
  fireEvent(screen.getByTestId('birth-year'), 'blur');
  expect(screen.getByTestId('birth-error-year')).toBeTruthy();
  fireEvent.press(screen.getByTestId('birth-submit'));
  expect(screen.getByTestId('birth-error-month')).toBeTruthy();
  expect(screen.getByTestId('birth-error-day')).toBeTruthy();
  expect(screen.getByTestId('birth-error-hour')).toBeTruthy();
  expect(screen.queryByTestId('birth-city')).toBeNull();
});
it('requires an hour or the unknown-time switch', () => {
  const birth = { ...emptyBirth(), year: 1990, month: 5, day: 15 };
  expect(stepOneIssues(birth, false).map((i) => i.key)).toEqual(['form.birth.error.hourRequired']);
  expect(stepOneIssues({ ...birth, hour: 0, minute: 0 }, false)).toEqual([]);
  expect(stepOneIssues({ ...birth, timeUnknown: true }, true)).toEqual([]);
  expect(stepOneIssues({ ...birth, month: 2, day: 30 }, true)[0]?.key).toBe(
    'form.birth.error.noSuchDay',
  );
});
it("saves someone else's profile without switching and returns to returnTo", async () => {
  mockParams = { returnTo: '/reading?system=bazi&after=1', system: 'bazi', relation: 'partner' };
  mockProfiles([profile('A')]);
  render(<BirthForm />);
  expect(screen.getByTestId('birth-for-other').props.accessibilityState.checked).toBe(true);
  await fillDate();
  fireEvent(screen.getByTestId('birth-branch'), 'valueChange', 7);
  fireEvent.press(screen.getByTestId('birth-submit'));
  await screen.findByTestId('birth-city');
  fireEvent.press(screen.getByTestId('birth-submit'));
  await waitFor(() => expect(mockSave).toHaveBeenCalled());
  expect(mockSave.mock.calls[0]![0]).toMatchObject({ relation: 'partner', birth: { hour: 7 } });
  expect(mockSave.mock.calls[0]![2]).toEqual({ activate: false });
  expect(mockReplace).toHaveBeenCalledWith('/reading?system=bazi&after=1');
});
it('blocks unconfirmed city text on step two', async () => {
  render(<BirthForm />);
  await fillDate();
  fireEvent(screen.getByTestId('time-unknown'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('birth-submit'));
  fireEvent.changeText(await screen.findByTestId('birth-city'), 'Bei');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  fireEvent.press(screen.getByTestId('birth-submit'));
  expect(await screen.findByTestId('birth-error-city')).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('birth-city-clear'));
  fireEvent.press(screen.getByTestId('birth-submit'));
  await waitFor(() => expect(mockSave).toHaveBeenCalled());
  expect(mockSave.mock.calls[0]![2]).toEqual({ activate: true });
  expect(mockReplace).toHaveBeenCalledWith('/me?saved=1');
});
it('stops a fourth anonymous profile before any input', () => {
  mockProfiles([profile('A'), profile('B'), profile('C')]);
  render(<BirthForm />);
  expect(screen.getByTestId('profile-limit')).toBeTruthy();
  expect(screen.queryByTestId('birth-year')).toBeNull();
});
it('accepts only in-app return paths and appends the system once', () => {
  expect(safeReturnTo('/reading?system=ziwei&profile=x')).toBe('/reading?system=ziwei&profile=x');
  expect(safeReturnTo('//evil.example')).toBeNull();
  expect(safeReturnTo('https://evil.example')).toBeNull();
  expect(safeReturnTo('javascript:alert(1)')).toBeNull();
  expect(birthDoneHref('/reading', 'ziwei')).toBe('/reading?system=ziwei');
  expect(birthDoneHref('/reading?system=bazi', 'ziwei')).toBe('/reading?system=bazi');
  expect(birthDoneHref(null, undefined)).toBe('/me?saved=1');
  expect(relationParam('other')).toBe('other');
  expect(relationParam('boss')).toBeNull();
});
it('searches and picks IANA zones', () => {
  expect(searchTimeZones('new york')[0]).toBe('America/New_York');
  expect(searchTimeZones('shanghai')[0]).toBe('Asia/Shanghai');
  const onChange = jest.fn();
  render(<TimezonePicker id="tz" value="UTC" onChange={onChange} />);
  fireEvent.changeText(screen.getByTestId('tz'), 'sydney');
  fireEvent.press(screen.getByTestId('tz-result-0'));
  expect(onChange).toHaveBeenCalledWith('Australia/Sydney');
});
