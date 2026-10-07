import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { ProfilesProvider, useProfiles } from '../lib/profiles';
import { createLocalStore } from '../lib/data/store';
import { testDatabase } from './sqlite';
import type { LocalDatabase } from '../lib/data/database';
import type { Profile } from '../lib/data/models';
import { BirthInputSchema } from '@tianji/shared';
import { setCurrentOwner } from '../lib/account/scope';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
let mockStore: ReturnType<typeof createLocalStore>;
let mockStores: Map<string | null, ReturnType<typeof createLocalStore>> | undefined;
jest.mock('../lib/data/store', () => ({
  ...jest.requireActual<typeof import('../lib/data/store')>('../lib/data/store'),
  getLocalStore: async (owner?: string | null) => mockStores?.get(owner ?? null) ?? mockStore,
}));
let database: LocalDatabase;
const profile: Profile = {
  name: 'Alice',
  birth: BirthInputSchema.parse(A),
  version: 1,
  isCurrent: true,
};
let mockState: ReturnType<typeof useProfiles>;
function Probe() {
  const state = useProfiles();
  mockState = state;
  return (
    <>
      <Text testID="count">{state.profiles.length}</Text>
      <Text testID="active">{state.active?.data?.name ?? ''}</Text>
      <Pressable testID="save" onPress={() => void state.save(profile)} />
      <Pressable testID="second" onPress={() => void state.save({ ...profile, name: 'Bob' })} />
      <Pressable
        testID="select"
        onPress={() =>
          void state.select(state.profiles.find((item) => item.data?.name === 'Alice')!.id)
        }
      />
      <Pressable
        testID="edit"
        onPress={() => void state.save({ ...profile, name: 'Alice edited' }, state.active!.id)}
      />
    </>
  );
}
beforeEach(async () => {
  setCurrentOwner(null);
  mockStores = undefined;
  database = await testDatabase();
  let index = 0;
  mockStore = createLocalStore(
    database,
    null,
    () => `m05-${++index}`,
    () => new Date('2026-10-07T00:00:00.000Z'),
  );
});
afterEach(async () => {
  await database.close();
});
it('persists two profiles, switches, edits the original version and reloads the active selection', async () => {
  const view = render(
    <ProfilesProvider>
      <Probe />
    </ProfilesProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Alice'));
  fireEvent.press(screen.getByTestId('second'));
  await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Bob'));
  fireEvent.press(screen.getByTestId('select'));
  await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Alice'));
  fireEvent.press(screen.getByTestId('edit'));
  await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Alice edited'));
  const saved = (await mockStore.profiles.list()).find(
    (item) => item.data?.name === 'Alice edited',
  )!;
  expect(saved.data?.version).toBe(2);
  expect((await mockStore.settings.list())[0]?.data?.activeProfileId).toBe(saved.id);
  view.unmount();
  render(
    <ProfilesProvider>
      <Probe />
    </ProfilesProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Alice edited'));
  expect(screen.getByTestId('count')).toHaveTextContent('2');
});

it('changes the single default without changing either birth version', async () => {
  const a = await mockStore.profiles.save({ ...profile, isDefault: true });
  const b = await mockStore.profiles.save({ ...profile, name: 'Bob', isDefault: false });
  render(
    <ProfilesProvider>
      <Probe />
    </ProfilesProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
  await act(async () => mockState.setDefault(b.id));
  const updated = await mockStore.profiles.list();
  expect(updated.filter((item) => item.data?.isDefault).map((item) => item.id)).toEqual([b.id]);
  expect(updated.every((item) => item.data?.version === 1)).toBe(true);
  expect((await mockStore.profiles.get(a.id))?.data?.version).toBe(1);
});
it('enforces the anonymous free limit even for a new explicit ID and still permits edits', async () => {
  const a = await mockStore.profiles.save(profile);
  await mockStore.profiles.save({ ...profile, name: 'Bob' });
  await mockStore.profiles.save({ ...profile, name: 'Carol' });
  render(
    <ProfilesProvider>
      <Probe />
    </ProfilesProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'));
  await act(async () => {
    await expect(mockState.save({ ...profile, name: 'Fourth' }, 'new-explicit-id')).rejects.toThrow(
      'E_PROFILE_LIMIT',
    );
    await mockState.save({ ...profile, name: 'Alice edited' }, a.id);
  });
  expect((await mockStore.profiles.list()).length).toBe(3);
  expect((await mockStore.profiles.get(a.id))?.data?.name).toBe('Alice edited');
});

it('account switches discard a delayed prior-owner projection and reject a stale default action', async () => {
  const alice = createLocalStore(database, 'alice', () => 'owner-alice-profile');
  const bob = createLocalStore(database, 'bob', () => 'owner-bob-profile');
  const a = await alice.profiles.save({ ...profile, name: 'Alice private', isDefault: true });
  await bob.profiles.save({ ...profile, name: 'Bob', isDefault: true });
  const oldRecords = await alice.profiles.list();
  let release: (records: typeof oldRecords) => void = () => {};
  mockStores = new Map([
    ['alice', alice],
    ['bob', bob],
  ]);
  setCurrentOwner('alice');
  render(
    <ProfilesProvider>
      <Probe />
    </ProfilesProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Alice private'));
  const oldState = mockState;
  jest.spyOn(alice.profiles, 'list').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await act(async () => {
    void oldState.reload();
  });
  await act(async () => setCurrentOwner('bob'));
  await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('Bob'));
  await act(async () => release(oldRecords));
  expect(screen.getByTestId('active')).toHaveTextContent('Bob');
  expect(screen.queryByText('Alice private')).toBeNull();
  await act(async () => {
    await expect(oldState.setDefault(a.id)).rejects.toThrow('E_FORBIDDEN');
  });
  expect((await bob.profiles.list())[0]?.data?.isDefault).toBe(true);
});
