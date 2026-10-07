import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import StoreCapture from '../app/dev/store';
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
const mockReload = jest.fn(async () => undefined);
const mockStore = jest.fn();
const mockParams = { scene: 'today', locale: 'en' };
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    Redirect: () => <Text testID="redirect">Redirect</Text>,
  };
});
jest.mock('../lib/data/store', () => ({ getLocalStore: () => mockStore() }));
jest.mock('../lib/profiles', () => ({ useProfiles: () => ({ reload: mockReload }) }));
jest.mock('../lib/reports/readings', () => ({ createNativeReading: jest.fn() }));
const originalDev = __DEV__;
afterEach(() => {
  Object.defineProperty(globalThis, '__DEV__', { value: originalDev, configurable: true });
  jest.clearAllMocks();
});
it('redirects release binaries without initializing or seeding storage', () => {
  Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true });
  render(<StoreCapture />);
  expect(screen.getByTestId('redirect')).toBeTruthy();
  expect(mockStore).not.toHaveBeenCalled();
});
it('requires an explicit automation start and shows a localized storage error', async () => {
  mockStore.mockRejectedValueOnce(new Error('E_STORAGE'));
  render(<StoreCapture />);
  expect(mockStore).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('store-go'));
  await waitFor(() =>
    expect(screen.getByTestId('store-prepare').props.children).toMatch(
      /could not be read or saved/,
    ),
  );
  expect(mockReplace).not.toHaveBeenCalled();
});
