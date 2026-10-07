import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SynastryScreen } from '../components/synastry-screen';
import { HistoryScreen } from '../components/history-screen';
import { useProfiles } from '../lib/profiles';
import { createNativeReading } from '../lib/reports/readings';
import { getLocalStore } from '../lib/data/store';
import { usePreferences } from '../lib/preferences';
import {
  SettingsSchema,
  type LocalRecord,
  type Profile,
  type LocalReading,
} from '../lib/data/models';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { BirthInputSchema } from '@tianji/shared';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../lib/profiles', () => ({ useProfiles: jest.fn() }));
jest.mock('../lib/data/store', () => ({ getLocalStore: jest.fn() }));
jest.mock('../lib/reports/readings', () => ({
  ...jest.requireActual<typeof import('../lib/reports/readings')>('../lib/reports/readings'),
  createNativeReading: jest.fn(),
}));
const record = <T,>(id: string, data: T | null): LocalRecord<T> => ({
  id,
  data,
  userId: null,
  createdAt: '2026-10-07T00:00:00Z',
  updatedAt: '2026-10-07T00:00:00Z',
  deletedAt: null,
});
const first = record<Profile>('A', {
  name: 'A',
  birth: BirthInputSchema.parse(A),
  version: 1,
  isCurrent: true,
});
const second = record<Profile>('B', {
  name: 'B',
  birth: { ...first.data!.birth, timeUnknown: true },
  version: 1,
  isCurrent: true,
});
beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: 'en' });
  jest.mocked(useProfiles).mockReturnValue({
    profiles: [first, second],
    active: first,
    settings: SettingsSchema.parse({}),
    loading: false,
    error: false,
    reload: jest.fn(),
    updateSettings: jest.fn(),
    save: jest.fn(),
    select: jest.fn(),
    remove: jest.fn(),
    setDefault: jest.fn(),
  });
});
it('disallows matching profiles and swaps directional partners before local creation', async () => {
  jest.mocked(createNativeReading).mockResolvedValue(record<LocalReading>('pair', null));
  render(<SynastryScreen />);
  expect(screen.getByTestId('synastry-b-A')).toBeDisabled();
  expect(screen.getByTestId('synastry-create')).toBeDisabled();
  fireEvent.press(screen.getByTestId('synastry-b-B'));
  expect(screen.getByTestId('synastry-a-B')).toBeDisabled();
  expect(screen.getByTestId('synastry-create')).not.toBeDisabled();
  fireEvent.press(screen.getByTestId('synastry-swap'));
  fireEvent.press(screen.getByTestId('synastry-create'));
  await waitFor(() => expect(createNativeReading).toHaveBeenCalledWith('synastry', second, first));
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/[system]/r/[id]',
      params: { system: 'synastry', id: 'pair' },
    }),
  );
});
it('requires a second saved profile and exposes the add-profile route', () => {
  jest.mocked(useProfiles).mockReturnValue({ ...useProfiles(), profiles: [first] });
  render(<SynastryScreen />);
  expect(screen.getByTestId('synastry-create')).toBeDisabled();
  fireEvent.press(screen.getByTestId('synastry-add'));
  expect(mockPush).toHaveBeenCalledWith('/me/birth');
});
it('history includes B-side synastry and excludes unrelated owned readings', async () => {
  const list = jest.fn(async () => [
    record('pair', {
      system: 'synastry',
      profileId: 'B',
      inputSnapshot: { partnerProfileId: 'A' },
    }),
    record('other', { system: 'bazi', profileId: 'B', inputSnapshot: {} }),
    record('divination', { system: 'iching', inputSnapshot: {} }),
  ]);
  // The screen only needs the repository read boundary; no SQL or owner checks are bypassed in production.
  jest
    .mocked(getLocalStore)
    .mockResolvedValue({ readings: { list } } as unknown as Awaited<
      ReturnType<typeof getLocalStore>
    >);
  render(<HistoryScreen />);
  await screen.findByTestId('history-pair');
  expect(screen.getByTestId('history-divination')).toBeTruthy();
  expect(screen.queryByTestId('history-other')).toBeNull();
  fireEvent.press(screen.getByTestId('history-pair'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/[system]/r/[id]',
    params: { system: 'synastry', id: 'pair' },
  });
});
