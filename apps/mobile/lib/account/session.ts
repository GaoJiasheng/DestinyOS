import { z } from 'zod';
import * as SecureStore from 'expo-secure-store';
import {
  createApiClient,
  ApiClientError,
  MobileTokensSchema,
  mobileRefreshEndpoint,
  type ApiEndpoint,
  type MobileTokens,
} from '@tianji/api-client';
import { brand } from '@tianji/shared/brand';
const storedSchema = MobileTokensSchema.extend({
  expiresAt: z.number(),
  refreshExpiresAt: z.number(),
  importDecision: z.enum(['pending', 'accepted', 'skipped']).default('pending'),
});
export type StoredSession = z.infer<typeof storedSchema>;
export interface CredentialStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}
const key = 'tianji.mobile.session.v1';
// DESIGN-GAP: Store the complete rotating pair/absolute expiries/consent in one SecureStore record; refresh 30 seconds early and bound rejected-request replay to one attempt.
const secureStorage: CredentialStorage = {
  read: () => SecureStore.getItemAsync(key),
  write: (value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: () => SecureStore.deleteItemAsync(key),
};
/** SecureStore-only rotating session manager. A single refresh serves concurrent API requests. */
export class SessionManager {
  session: StoredSession | null = null;
  private refreshFlight: Promise<StoredSession> | undefined;
  private readonly api;
  constructor(
    private readonly storage: CredentialStorage = secureStorage,
    transport: typeof fetch = globalThis.fetch,
    private readonly now = Date.now,
    private readonly changed = () => {},
  ) {
    this.api = createApiClient({
      baseUrl: `https://${brand.domain}`,
      fetch: transport,
      accessToken: () => this.session?.accessToken,
    });
  }
  /** Restore credentials before exposing account-scoped local content. */
  async restore() {
    const raw = await this.storage.read();
    if (!raw) return;
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw) as unknown;
    } catch {
      await this.clear();
      return;
    }
    const result = storedSchema.safeParse(decoded);
    if (!result.success || result.data.refreshExpiresAt <= this.now()) {
      await this.clear();
      return;
    }
    this.session = result.data;
    this.changed();
  }
  /** Persist the entire pair atomically before switching the local owner. */
  async accept(tokens: MobileTokens) {
    const parsed = MobileTokensSchema.parse(tokens);
    const value = {
      ...parsed,
      importDecision:
        this.session?.userId === parsed.userId ? this.session.importDecision : ('pending' as const),
      expiresAt: this.now() + parsed.expiresIn * 1000,
      refreshExpiresAt: this.now() + parsed.refreshExpiresIn * 1000,
    };
    await this.storage.write(JSON.stringify(value));
    this.session = value;
    this.changed();
    return value;
  }
  /** Persist explicit anonymous import consent alongside this device session. */
  async decide(importDecision: 'accepted' | 'skipped') {
    if (!this.session) throw new Error('E_UNAUTHORIZED');
    const value = { ...this.session, importDecision };
    await this.storage.write(JSON.stringify(value));
    this.session = value;
    this.changed();
  }
  /** Forget revoked/deleted credentials; network errors never erase a usable refresh token. */
  async clear() {
    await this.storage.remove();
    this.session = null;
    this.changed();
  }
  private refresh() {
    if (!this.refreshFlight) {
      const previous = this.session;
      if (!previous) return Promise.reject(new ApiClientError('E_UNAUTHORIZED', 401, 'api'));
      this.refreshFlight = this.api
        .request(mobileRefreshEndpoint, { refreshToken: previous.refreshToken })
        .then(async (value) => {
          if (this.session !== previous) throw new ApiClientError('E_UNAUTHORIZED', 401, 'api');
          return this.accept(value);
        })
        .catch(async (error: unknown) => {
          if (error instanceof ApiClientError && error.status === 401 && this.session === previous)
            await this.clear();
          throw error;
        })
        .finally(() => {
          this.refreshFlight = undefined;
        });
    }
    return this.refreshFlight;
  }
  /** Proactively refresh within 30 seconds of expiry and replay one rejected request after rotation. */
  async request<I extends z.ZodType<unknown>, O extends z.ZodType<unknown>>(
    endpoint: ApiEndpoint<I, O>,
    input: z.input<I>,
  ): Promise<z.output<O>> {
    if (!this.session) throw new ApiClientError('E_UNAUTHORIZED', 401, 'api');
    if (this.session.expiresAt <= this.now() + 30000) await this.refresh();
    const attemptedToken = this.session?.accessToken;
    const send = () => this.api.request(endpoint, input);
    try {
      return await send();
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 401) throw error;
      if (this.session?.accessToken === attemptedToken) await this.refresh();
      return send();
    }
  }
}
