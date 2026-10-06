import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { ProfilesProvider, useProfiles } from '../lib/profiles';
import { createLocalStore } from '../lib/data/store';
import { testDatabase } from './sqlite';
import type { LocalDatabase } from '../lib/data/database';
import type { Profile } from '../lib/data/models';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
let mockStore: ReturnType<typeof createLocalStore>;
jest.mock('../lib/data/store', () => ({
  ...jest.requireActual<typeof import('../lib/data/store')>('../lib/data/store'),
  getLocalStore: async () => mockStore,
}));
let database: LocalDatabase;
const profile: Profile = {
  name: 'Alice',
  birth: BirthInputSchema.parse(A),
  version: 1,
  isCurrent: true,
};
function Probe() {
  const state = useProfiles();
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
