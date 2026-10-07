import {
  accountSession,
  configureAccountMock,
  confirmMagicLink,
  loginProvider,
  logoutAccount,
  deleteAccount,
  syncAccount,
  useAccount,
} from '../lib/account/controller';
import { synchronize } from '../lib/account/sync';
import { currentOwner, setCurrentOwner } from '../lib/account/scope';
import { mobileSessionsEndpoint, type MobileTokens } from '@tianji/api-client';
import * as SecureStore from 'expo-secure-store';
import { getLocalStore } from '../lib/data/store';
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: async () => {},
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));
jest.mock('../lib/data/store', () => {
  const store = { eraseAccountData: jest.fn(async () => {}) };
  return { getLocalStore: async () => store };
});
jest.mock('../lib/account/sync', () => ({
  anonymousCount: async () => 1,
  mergeAnonymous: jest.fn(),
  synchronize: jest.fn(),
}));
jest.mock('../lib/account/oauth', () => ({
  publicApi: (fetcher: typeof fetch) =>
    jest.requireActual<typeof import('@tianji/api-client')>('@tianji/api-client').createApiClient({
      baseUrl: 'https://tianji.gavin.pub',
      fetch: fetcher,
    }),
  device: () => ({ platform: 'ios', deviceName: 'Synthetic iPhone' }),
  signInProvider: jest.fn(),
}));
const pair = (userId: string, token: string): MobileTokens => ({
  userId,
  accessToken: token.repeat(43),
  refreshToken: token.repeat(43),
  sessionId: '9fba18f5-429b-463e-9d9a-55072d4c76c1',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshExpiresIn: 5184000,
});
it.each(['magic', 'provider'] as const)(
  'finishes Alice sync with Alice credentials before %s switches to Bob and asks for import consent',
  async (method) => {
    jest.mocked(synchronize).mockReset().mockResolvedValue(undefined);
    jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
    const alice = pair('alice', 'a'),
      bob = pair('bob', 'b');
    const requests: string[] = [];
    const fetcher: typeof fetch = async (input, options) => {
      const magic = String(input).endsWith('auth/magic/verify');
      if (!magic) requests.push(new Headers(options?.headers).get('Authorization') ?? '');
      return new Response(JSON.stringify({ ok: true, data: magic ? bob : { sessions: [] } }));
    };
    await configureAccountMock(fetcher, async () => bob);
    await accountSession.accept(alice);
    setCurrentOwner('alice');
    useAccount.setState({ pending: 0, lastSync: '2026-10-07T00:00:00Z' });
    let release = () => {};
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let releaseWrite = () => {},
      writing = () => {};
    const writeBarrier = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeReached = new Promise<void>((resolve) => {
      writing = resolve;
    });
    jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(async () => {
      writing();
      await writeBarrier;
    });
    jest.mocked(synchronize).mockImplementationOnce(async (manager) => {
      await barrier;
      await manager.request(mobileSessionsEndpoint, {});
    });
    const syncing = syncAccount();
    const switching =
      method === 'magic'
        ? confirmMagicLink('bob@example.test', 'synthetic-magic-token')
        : loginProvider('google');
    // Drain the public credential exchange while the previous owner's upload remains blocked.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(accountSession.session?.userId).toBe('alice');
    expect(currentOwner()).toBe('alice');
    release();
    await writeReached;
    // A foreground trigger during the keychain write cannot start another Alice upload.
    await syncAccount();
    expect(synchronize).toHaveBeenCalledTimes(1);
    releaseWrite();
    await Promise.all([syncing, switching]);
    expect(requests).toEqual([`Bearer ${alice.accessToken}`]);
    expect(accountSession.session?.userId).toBe('bob');
    expect(useAccount.getState()).toMatchObject({ pending: 1, lastSync: null });
    expect(currentOwner()).toBeNull();
    await accountSession.request(mobileSessionsEndpoint, {});
    expect(requests.at(-1)).toBe(`Bearer ${bob.accessToken}`);
  },
);
it.each(['logout', 'delete'] as const)(
  'pauses foreground sync until %s has revoked credentials and completed local cleanup',
  async (method) => {
    jest.mocked(synchronize).mockReset().mockResolvedValue(undefined);
    jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
    const store = await getLocalStore('alice');
    jest.mocked(store.eraseAccountData).mockClear();
    let release = () => {},
      requested = () => {};
    const serverBarrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requestReached = new Promise<void>((resolve) => {
      requested = resolve;
    });
    const fetcher: typeof fetch = async () => {
      requested();
      await serverBarrier;
      return new Response(
        JSON.stringify({
          ok: true,
          data: method === 'delete' ? { deleted: true } : { loggedOut: true },
        }),
      );
    };
    await configureAccountMock(fetcher, async () => pair('alice', 'a'));
    await accountSession.accept(pair('alice', 'a'));
    setCurrentOwner('alice');
    const mutation = method === 'delete' ? deleteAccount('DELETE', true) : logoutAccount();
    await requestReached;
    await syncAccount();
    expect(synchronize).not.toHaveBeenCalled();
    release();
    await mutation;
    expect(accountSession.session).toBeNull();
    expect(currentOwner()).toBeNull();
    expect(store.eraseAccountData).toHaveBeenCalledTimes(method === 'delete' ? 1 : 0);
  },
);
