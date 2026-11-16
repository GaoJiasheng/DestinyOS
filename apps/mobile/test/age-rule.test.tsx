import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AgeRestricted from '../app/age-restricted';
import { useProfiles } from '../lib/profiles';
import { useAccount } from '../lib/account/controller';
import { SettingsSchema } from '../lib/data/models';

const mockReplace = jest.fn();
const mockErase = jest.fn(async () => undefined);
const mockLogout = jest.fn(async () => undefined);
const mockReload = jest.fn(async () => undefined);
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../lib/profiles', () => ({ useProfiles: jest.fn() }));
jest.mock('../lib/data/store', () => ({
  getLocalStore: async () => ({ eraseDeviceData: mockErase }),
}));
jest.mock('../lib/account/controller', () => ({
  useAccount: { getState: jest.fn() },
  logoutAccount: () => mockLogout(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useProfiles).mockReturnValue({
    settings: SettingsSchema.parse({ ageBlocked: true }),
    reload: mockReload,
  } as unknown as ReturnType<typeof useProfiles>);
  jest.mocked(useAccount.getState).mockReturnValue({ session: null } as never);
});
function confirmErase() {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  render(<AgeRestricted />);
  fireEvent.press(screen.getByTestId('age-erase'));
  expect(mockErase).not.toHaveBeenCalled();
  alert.mock.calls[0]![2]![1]!.onPress!();
  alert.mockRestore();
}
it('clears the device after confirmation and returns to onboarding', async () => {
  confirmErase();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(mockErase).toHaveBeenCalledTimes(1);
  expect(mockReload).toHaveBeenCalled();
  expect(mockLogout).not.toHaveBeenCalled();
});
it('signs out of a signed-in account before erasing', async () => {
  jest.mocked(useAccount.getState).mockReturnValue({ session: { id: 's' } } as never);
  confirmErase();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(mockLogout).toHaveBeenCalledTimes(1);
});
it('stays on the lock page when erasing fails', async () => {
  mockErase.mockRejectedValueOnce(new Error('x'));
  confirmErase();
  await screen.findByTestId('age-erase-error');
  expect(mockReplace).not.toHaveBeenCalled();
});
