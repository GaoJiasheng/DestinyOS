import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Redirect } from 'expo-router';
import { SessionGate } from '../components/session-gate';
import { SettingsSchema } from '../lib/data/models';
const mockState = { loading: true, error: false, settings: SettingsSchema.parse({}) };
jest.mock('../lib/profiles', () => ({ useProfiles: () => mockState }));
jest.mock('expo-router', () => ({
  useSegments: () => ['auth', 'verify'],
  Redirect: jest.fn(() => null),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockState.loading = true;
  mockState.error = false;
  mockState.settings = SettingsSchema.parse({});
});
const content = () => (
  <SessionGate>
    <Text testID="credential-surface">Test credential surface</Text>
  </SessionGate>
);
it('waits for encrypted age state and blocks an under-13 universal link before exposing credentials', () => {
  const view = render(content());
  expect(screen.queryByTestId('credential-surface')).toBeNull();
  mockState.loading = false;
  mockState.settings = SettingsSchema.parse({ ageBlocked: true });
  view.rerender(content());
  expect(screen.queryByTestId('credential-surface')).toBeNull();
  expect(jest.mocked(Redirect).mock.calls[0]?.[0]).toMatchObject({ href: '/age-restricted' });
});
it('allows verification before optional onboarding only when storage and age state are valid', () => {
  mockState.loading = false;
  mockState.error = true;
  const view = render(content());
  expect(screen.queryByTestId('credential-surface')).toBeNull();
  mockState.error = false;
  view.rerender(content());
  expect(screen.getByTestId('credential-surface')).toBeVisible();
  mockState.loading = true;
  view.rerender(content());
  expect(screen.getByTestId('credential-surface')).toBeVisible();
  mockState.loading = false;
  mockState.settings = SettingsSchema.parse({ ageBlocked: true });
  view.rerender(content());
  expect(screen.queryByTestId('credential-surface')).toBeNull();
});
