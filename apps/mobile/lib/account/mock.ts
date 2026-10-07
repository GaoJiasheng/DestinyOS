import * as Crypto from 'expo-crypto';
import type { MobileTokens, MobileResource } from '@tianji/api-client';
import { z } from 'zod';
import { getLocalStore } from '../data/store';
import type { LocalReading } from '../data/models';
const token = () => (Crypto.randomUUID() + Crypto.randomUUID()).replaceAll('-', '').slice(0, 43);
/** In-memory identity/sync server for development Maestro; has no production bypass or external network. */
export function createAccountMock(
  initial?: MobileTokens,
  readSnapshot: (id: string) => Promise<LocalReading | null> = async (id) =>
    (await (await getLocalStore('M10-mock-user')).readings.get(id))?.data ?? null,
) {
  if (!__DEV__) throw new Error('E_FORBIDDEN');
  const userId = 'M10-mock-user',
    sessionId = initial?.sessionId ?? Crypto.randomUUID(),
    otherId = Crypto.randomUUID();
  let credentials: MobileTokens | null = initial ?? null,
    offline = false,
    magicUsed = false,
    other = true;
  const records: Record<MobileResource, Map<string, Record<string, unknown>>> = {
    profiles: new Map(),
    readings: new Map(),
    journal: new Map(),
    settings: new Map(),
  };
  function issue(): MobileTokens {
    credentials = {
      accessToken: token(),
      refreshToken: token(),
      sessionId,
      userId,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresIn: 5184000,
    };
    return credentials;
  }
  const ok = (data: unknown) =>
    new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  const denied = () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'E_UNAUTHORIZED', message: 'Invalid credential' },
      }),
      { status: 401 },
    );
  const fetcher: typeof fetch = async (input, options) => {
    if (offline) throw new TypeError('Network unavailable');
    const url = new URL(String(input)),
      path = url.pathname.replace('/api/v1/mobile/', '');
    const body =
      typeof options?.body === 'string'
        ? (JSON.parse(options.body) as Record<string, unknown>)
        : {};
    if (path === 'auth/magic/request') {
      magicUsed = false;
      return ok({ sent: true });
    }
    if (path === 'auth/magic/verify') {
      if (magicUsed || body.token !== 'M10-magic-token-1234567890') return denied();
      magicUsed = true;
      return ok(issue());
    }
    if (path === 'auth/refresh') {
      if (body.refreshToken !== credentials?.refreshToken) return denied();
      return ok(issue());
    }
    if (
      new Headers(options?.headers).get('Authorization') !== `Bearer ${credentials?.accessToken}` ||
      !credentials
    )
      return denied();
    if (path === 'auth/logout') {
      credentials = null;
      return ok({ loggedOut: true });
    }
    if (path === 'account') {
      credentials = null;
      for (const map of Object.values(records)) map.clear();
      return ok({ deleted: true });
    }
    if (path === 'auth/sessions') {
      if (options?.method === 'DELETE') {
        if (body.sessionId === sessionId) credentials = null;
        else other = false;
        return ok({ revoked: true });
      }
      const now = new Date().toISOString();
      return ok({
        sessions: [
          {
            id: sessionId,
            deviceName: 'iPhone 17e',
            platform: 'ios',
            createdAt: now,
            lastUsedAt: now,
            current: true,
          },
          ...(other
            ? [
                {
                  id: otherId,
                  deviceName: 'Pixel 9',
                  platform: 'android',
                  createdAt: now,
                  lastUsedAt: now,
                  current: false,
                },
              ]
            : []),
        ],
      });
    }
    const resource = z
      .enum(['profiles', 'readings', 'journal', 'settings'])
      .parse(path.split('/')[1]);
    const map = records[resource];
    if (options?.method === 'PUT') {
      const items = await Promise.all(
        z
          .array(z.record(z.unknown()))
          .parse(body.items)
          .map(async (item) => {
            if (item.deleted) return item;
            if (resource === 'profiles') return { ...item, version: 1, isDefault: true };
            if (resource === 'readings') {
              // DESIGN-GAP: The identity mock echoes the encrypted local report snapshot; production sync recomputes through the Worker and never uses this development transport.
              const snapshot = await readSnapshot(z.string().parse(item.id));
              if (!snapshot) throw new Error('E_NOT_FOUND');
              return { ...snapshot, ...item };
            }
            if (resource === 'journal') {
              const entry = z.record(z.unknown()).parse(item.entry);
              return {
                ...item,
                ...entry,
                prediction: {
                  scores: { overall: 50, career: 50, love: 50, wealth: 50, health: 50, social: 50 },
                  tz: entry.tz,
                  profileVersion: 1,
                  engineVersion: 'mock',
                },
                createdAt: item.updatedAt,
              };
            }
            return item;
          }),
      );
      for (const item of items) map.set(String(item.id), item);
      return ok({ items });
    }
    return ok({ items: [...map.values()], cursor: 'mock-cursor', hasMore: false });
  };
  return {
    fetcher,
    provider: async () => issue(),
    setOffline: (value: boolean) => {
      offline = value;
    },
    expire: () => {
      if (credentials) credentials = { ...credentials, accessToken: token() };
    },
  };
}
