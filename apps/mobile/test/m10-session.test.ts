import { SessionManager, type CredentialStorage } from '../lib/account/session';
import { mobileSessionsEndpoint, type MobileTokens } from '@tianji/api-client';
const pair = (generation = 0): MobileTokens => ({
  accessToken: String(generation).padStart(43, 'a'),
  refreshToken: String(generation).padStart(43, 'r'),
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshExpiresIn: 5184000,
  sessionId: '9fba18f5-429b-463e-9d9a-55072d4c76c1',
  userId: 'alice',
});
const reply = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      status === 200
        ? { ok: true, data }
        : { ok: false, error: { code: 'E_UNAUTHORIZED', message: 'Expired' } },
    ),
    { status },
  );
function storage() {
  let value: string | null = null;
  const adapter: CredentialStorage = {
    read: async () => value,
    write: async (next) => {
      value = next;
    },
    remove: async () => {
      value = null;
    },
  };
  return adapter;
}
it('stores the pair securely, restores absolute expiry and preserves import consent on rotation', async () => {
  let now = 1000,
    refresh = 0;
  const vault = storage();
  const fetcher: typeof fetch = async (url) =>
    String(url).endsWith('auth/refresh')
      ? (refresh++, reply(pair(refresh)))
      : reply({ sessions: [] });
  const first = new SessionManager(vault, fetcher, () => now);
  await first.accept(pair());
  await first.decide('skipped');
  const restored = new SessionManager(vault, fetcher, () => now);
  await restored.restore();
  now += 900001;
  await Promise.all(Array.from({ length: 6 }, () => restored.request(mobileSessionsEndpoint, {})));
  expect(refresh).toBe(1);
  expect(restored.session?.importDecision).toBe('skipped');
  const final = new SessionManager(vault, fetcher, () => now);
  await final.restore();
  expect(final.session?.refreshToken).toBe(pair(1).refreshToken);
});
it('retries expired access once, clears revoked refresh, and retains tokens during network failure', async () => {
  const vault = storage();
  let mode = 'expired';
  const fetcher: typeof fetch = async (url) => {
    if (mode === 'offline') throw new TypeError('offline');
    if (String(url).endsWith('auth/refresh'))
      return mode === 'revoked' ? reply(null, 401) : reply(pair(1));
    return mode === 'expired' ? ((mode = 'ok'), reply(null, 401)) : reply({ sessions: [] });
  };
  const manager = new SessionManager(vault, fetcher);
  await manager.accept(pair());
  await manager.request(mobileSessionsEndpoint, {});
  expect(manager.session?.accessToken).toBe(pair(1).accessToken);
  mode = 'offline';
  await expect(manager.request(mobileSessionsEndpoint, {})).rejects.toThrow();
  expect(manager.session).not.toBeNull();
  mode = 'revoked';
  manager.session!.expiresAt = 0;
  await expect(manager.request(mobileSessionsEndpoint, {})).rejects.toMatchObject({ status: 401 });
  expect(manager.session).toBeNull();
  expect(await vault.read()).toBeNull();
});
it('does not expose an identity if SecureStore persistence fails and discards malformed/expired credentials', async () => {
  const manager = new SessionManager({
    read: async () => null,
    write: async () => {
      throw new Error('locked');
    },
    remove: async () => {},
  });
  await expect(manager.accept(pair())).rejects.toThrow('locked');
  expect(manager.session).toBeNull();
  const vault = storage();
  await vault.write('{bad json');
  const restored = new SessionManager(vault);
  await restored.restore();
  expect(await vault.read()).toBeNull();
  await vault.write(JSON.stringify({ ...pair(), expiresAt: 1, refreshExpiresAt: 1 }));
  await restored.restore();
  expect(restored.session).toBeNull();
});
