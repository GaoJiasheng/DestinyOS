import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LoginScreen, VerifyScreen, AccountSettingsScreen } from '../components/account-screen';
import { DeviceScreen } from '../components/device-screen';
import {
  useAccount,
  loginProvider,
  confirmMagicLink,
  decideImport,
  deleteAccount,
  accountSession,
} from '../lib/account/controller';
import { usePreferences } from '../lib/preferences';
import { Alert } from 'react-native';
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../lib/account/controller', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  const store = create(() => ({
    session: null,
    ready: true,
    busy: false,
    pending: 0,
    syncing: false,
    error: null,
    lastSync: null,
    deleted: false,
  }));
  return {
    useAccount: store,
    accountAction: async (operation: () => Promise<void>) => operation(),
    loginProvider: jest.fn(async () => {}),
    requestMagicLink: jest.fn(async () => {}),
    confirmMagicLink: jest.fn(async () => {}),
    decideImport: jest.fn(async () => {}),
    logoutAccount: jest.fn(async () => {}),
    syncAccount: jest.fn(async () => {}),
    deleteAccount: jest.fn(async () => {
      store.setState({ session: null, deleted: true });
    }),
    accountSession: { request: jest.fn(), clear: jest.fn(async () => {}) },
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  usePreferences.setState({ locale: 'en', theme: 'auto' });
  useAccount.setState({
    session: null,
    pending: 0,
    busy: false,
    error: null,
    lastSync: null,
    deleted: false,
  });
});
const session = {
  accessToken: 'a'.repeat(43),
  refreshToken: 'r'.repeat(43),
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  refreshExpiresIn: 5184000,
  sessionId: 'test',
  userId: 'alice',
  expiresAt: Date.now() + 900000,
  refreshExpiresAt: Date.now() + 5184000000,
  importDecision: 'pending' as const,
};
it('offers all providers and requires explicit import/skip decisions without automatic uploads', async () => {
  render(<LoginScreen />);
  fireEvent.press(screen.getByTestId('account-google'));
  await waitFor(() => expect(loginProvider).toHaveBeenCalledWith('google'));
  screen.unmount();
  useAccount.setState({ session, pending: 3 });
  render(<LoginScreen />);
  expect(screen.getByTestId('account-import-prompt')).toHaveTextContent(/Import 3 anonymous items/);
  expect(decideImport).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('account-import-skip'));
  await waitFor(() => expect(decideImport).toHaveBeenCalledWith(false));
  fireEvent.press(screen.getByTestId('account-import-confirm'));
  await waitFor(() => expect(decideImport).toHaveBeenCalledWith(true));
  act(() => useAccount.setState({ pending: 0, busy: true }));
  expect(screen.getByTestId('account-continue')).toBeDisabled();
});
it('never consumes a universal link until confirmation and removes it from navigation after success', async () => {
  mockParams = { email: 'alice@example.test', token: 'magic-token' };
  render(<VerifyScreen />);
  expect(confirmMagicLink).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('account-magic-confirm'));
  await waitFor(() =>
    expect(confirmMagicLink).toHaveBeenCalledWith('alice@example.test', 'magic-token'),
  );
  expect(mockReplace).toHaveBeenCalledWith('/auth/login');
});
it.each(['zh', 'en'] as const)(
  'guards account deletion with exact DELETE and preserves the optional feedback choice (%s)',
  async (locale) => {
    usePreferences.setState({ locale });
    useAccount.setState({ session });
    render(<AccountSettingsScreen />);
    fireEvent.press(screen.getByTestId('account-delete'));
    expect(deleteAccount).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('account-delete-text'), 'delete');
    expect(screen.getByTestId('account-delete')).toBeDisabled();
    fireEvent.changeText(screen.getByTestId('account-delete-text'), 'DELETE');
    fireEvent.press(screen.getByTestId('account-delete-feedback'));
    fireEvent.press(screen.getByTestId('account-delete'));
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('DELETE', true));
    expect(await screen.findByTestId('account-deleted')).toBeVisible();
    screen.unmount();
    render(<AccountSettingsScreen />);
    expect(screen.getByTestId('account-deleted')).toBeVisible();
  },
);
it('loads current and other devices and confirms before revoking only the chosen identity', async () => {
  useAccount.setState({ session });
  const now = new Date().toISOString();
  jest
    .mocked(accountSession.request)
    .mockResolvedValueOnce({
      sessions: [
        {
          id: 'other',
          deviceName: 'Pixel',
          platform: 'android',
          current: false,
          createdAt: now,
          lastUsedAt: now,
        },
      ],
    })
    .mockResolvedValueOnce({ revoked: true })
    .mockResolvedValueOnce({ sessions: [] });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<DeviceScreen />);
  fireEvent.press(await screen.findByTestId('account-device-other'));
  expect(accountSession.request).toHaveBeenCalledTimes(1);
  const buttons = alert.mock.calls[0]?.[2];
  await act(async () => {
    await buttons?.[1]?.onPress?.();
  });
  await waitFor(() =>
    expect(accountSession.request).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v1/mobile/auth/sessions', method: 'DELETE' }),
      { sessionId: 'other' },
    ),
  );
  alert.mockRestore();
});
