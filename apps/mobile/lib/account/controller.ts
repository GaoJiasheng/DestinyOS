import { create } from 'zustand';
import {
  ApiClientError,
  mobileLogoutEndpoint,
  mobileDeleteEndpoint,
  mobileMagicRequestEndpoint,
  mobileMagicVerifyEndpoint,
  type MobileTokens,
} from '@tianji/api-client';
import { getLocalStore } from '../data/store';
import { SessionManager, type StoredSession } from './session';
import { anonymousCount, mergeAnonymous, synchronize } from './sync';
import { setCurrentOwner } from './scope';
import { publicApi, device, signInProvider } from './oauth';
import { usePreferences } from '../preferences';
import { SettingsSchema } from '../data/models';
import type { MessageKey } from '../i18n';
interface AccountState {
  session: StoredSession | null;
  ready: boolean;
  busy: boolean;
  pending: number;
  syncing: boolean;
  error: MessageKey | null;
  lastSync: string | null;
  mock: boolean;
  deleted: boolean;
}
export const useAccount = create<AccountState>(() => ({
  session: null,
  ready: false,
  busy: false,
  pending: 0,
  syncing: false,
  error: null,
  lastSync: null,
  mock: false,
  deleted: false,
}));
let transport: typeof fetch | undefined;
export let accountSession = new SessionManager(undefined, globalThis.fetch, Date.now, () => {
  const session = accountSession.session;
  useAccount.setState({ session });
  if (!session) setCurrentOwner(null);
});
let syncFlight: Promise<void> | undefined;
let restoreFlight: Promise<void> | undefined;
let identityChanging = false;
/** Map transport/provider errors to shared bilingual copy; raw exception details never reach UI. */
export function accountError(error: unknown): MessageKey {
  if (error instanceof ApiClientError) {
    if (error.code === 'E_VALIDATION') return 'auth.error.validation';
    if (error.code === 'E_PROFILE_LIMIT') return 'report.error.E_PROFILE_LIMIT';
    if (error.code === 'E_AGE_RESTRICTED') return 'errors.E_AGE_RESTRICTED';
    if (error.status === 401) return 'auth.error.verification';
    if (error.status === 409) return 'mobile.account.providerConflict';
    if (error.status === 429) return 'mobile.account.rateLimited';
    if (error.status === 400) return 'auth.error.validation';
  }
  if (error instanceof Error && error.message === 'E_PROVIDER_UNAVAILABLE')
    return 'mobile.account.unavailable';
  return 'mobile.account.network';
}
async function activate() {
  const session = accountSession.session;
  if (!session) return;
  const anonymous = await getLocalStore(null);
  const count = session.importDecision === 'pending' ? await anonymousCount(anonymous) : 0;
  useAccount.setState({ pending: count });
  if (count) {
    // DESIGN-GAP: Pending import stays in the anonymous scope, including when a magic link switches from a different signed-in account.
    setCurrentOwner(null);
    await usePreferences.persist.rehydrate();
    return;
  }
  if (session.importDecision === 'pending') await accountSession.decide('skipped');
  // Carry device onboarding acknowledgement without uploading anonymous birth data/settings.
  const local = await getLocalStore(session.userId);
  if (!(await local.settings.list(1))[0]) {
    // DESIGN-GAP: Onboarding-only scaffolding is not a user edit; an epoch timestamp lets existing server preferences win the first sync.
    const timestamp = '1970-01-01T00:00:00.000Z';
    await local.settings.applyRemote([
      {
        id: session.userId,
        userId: session.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        data: SettingsSchema.parse({
          onboardingVersion: 1,
          locale: usePreferences.getState().locale,
          theme: usePreferences.getState().theme,
        }),
      },
    ]);
    await local.database.write((sql) =>
      sql.runAsync(
        'INSERT OR IGNORE INTO MobileSyncState(userId,resource,uploadedAt) VALUES(?,?,?)',
        session.userId,
        'settings',
        '1970-01-01T00:00:00.001Z',
      ),
    );
  }
  setCurrentOwner(session.userId);
  await usePreferences.persist.rehydrate();
  void syncAccount();
}
/** Restore SecureStore once and leave offline account content usable when the network fails. */
export function restoreAccount() {
  if (!restoreFlight)
    restoreFlight = (async () => {
      try {
        await accountSession.restore();
        if (accountSession.session?.userId === 'M10-mock-user') {
          if (!__DEV__) {
            await accountSession.clear();
            return;
          }
          // DESIGN-GAP: Restore diagnostic transport before any synthetic session can contact the production Worker after a Metro reload.
          const { createAccountMock } = await import('./mock');
          const restoredMock = createAccountMock(accountSession.session);
          diagnosticMock = restoredMock;
          transport = restoredMock.fetcher;
          mockProvider = restoredMock.provider;
          accountSession = createDiagnosticSession(transport);
          await accountSession.restore();
          useAccount.setState({ mock: true });
        }
        await activate();
      } catch (error) {
        useAccount.setState({ error: accountError(error) });
      } finally {
        useAccount.setState({ ready: true });
        void syncAccount();
      }
    })();
  return restoreFlight;
}
/** Serialize sign-in/UI mutations and surface localized recoverable failures. */
export async function accountAction(operation: () => Promise<void>) {
  if (useAccount.getState().busy) return;
  useAccount.setState({ busy: true, error: null });
  try {
    await operation();
  } catch (error) {
    useAccount.setState({ error: accountError(error) });
  } finally {
    useAccount.setState({ busy: false });
  }
}
/** Start native provider authentication; cancellation preserves anonymous content. */
export async function loginProvider(provider: 'apple' | 'google') {
  const locale = usePreferences.getState().locale;
  const tokens = mockProvider
    ? await mockProvider(provider)
    : await signInProvider(provider, locale, transport);
  if (tokens) await acceptIdentity(tokens);
}
async function acceptIdentity(tokens: MobileTokens) {
  await mutateIdentity(async () => {
    await accountSession.accept(tokens);
    setCurrentOwner(null);
    useAccount.setState({ deleted: false, lastSync: null });
    await activate();
  });
}
async function mutateIdentity(operation: () => Promise<void>) {
  // DESIGN-GAP: Pause new sync triggers and finish the owner's sync during identity changes, SecureStore writes or account erasure; uploads must never cross accounts or restore deleted data.
  identityChanging = true;
  try {
    await syncFlight;
    await operation();
  } finally {
    identityChanging = false;
    void syncAccount();
  }
}
/** Request a single-use universal link using the documented email template and limits. */
export async function requestMagicLink(email: string) {
  await publicApi(transport).request(mobileMagicRequestEndpoint, {
    email,
    locale: usePreferences.getState().locale,
  });
}
/** Consume magic links only after the user presses Confirm sign-in. */
export async function confirmMagicLink(email: string, token: string) {
  const tokens = await publicApi(transport).request(mobileMagicVerifyEndpoint, {
    ...device(),
    email,
    token,
    locale: usePreferences.getState().locale,
  });
  await acceptIdentity(tokens);
}
/** Apply explicit anonymous upload consent; declining keeps anonymous data on the device. */
export async function decideImport(accepted: boolean) {
  const session = accountSession.session;
  if (!session) throw new Error('E_UNAUTHORIZED');
  if (accepted) await mergeAnonymous(await getLocalStore(null), session.userId);
  await accountSession.decide(accepted ? 'accepted' : 'skipped');
  useAccount.setState({ pending: 0 });
  await activate();
}
/** Sync on login, foreground/resume and explicit retry; concurrent triggers share one flight. */
export function syncAccount() {
  if (syncFlight) return syncFlight;
  if (identityChanging) return Promise.resolve();
  if (!useAccount.getState().ready) return Promise.resolve();
  if (!accountSession.session || useAccount.getState().pending) return Promise.resolve();
  useAccount.setState({ syncing: true, error: null });
  syncFlight = synchronize(accountSession, usePreferences.getState().locale)
    .then(async () => {
      await usePreferences.persist.rehydrate();
      setCurrentOwner(accountSession.session?.userId ?? null);
      useAccount.setState({ lastSync: new Date().toISOString() });
    })
    .catch((error: unknown) => {
      useAccount.setState({ error: accountError(error) });
    })
    .finally(() => {
      useAccount.setState({ syncing: false });
      syncFlight = undefined;
    });
  return syncFlight;
}
/** Revoke the current device remotely before forgetting credentials, allowing offline retries. */
export async function logoutAccount() {
  await mutateIdentity(async () => {
    await accountSession.request(mobileLogoutEndpoint, {});
    await accountSession.clear();
    useAccount.setState({ pending: 0, lastSync: null });
    await usePreferences.persist.rehydrate();
  });
}
/** Reuse Web's seven-day account deletion, then wipe this account's encrypted device cache. */
export async function deleteAccount(confirmText: 'DELETE', deleteFeedback: boolean) {
  await mutateIdentity(async () => {
    const userId = accountSession.session?.userId;
    await accountSession.request(mobileDeleteEndpoint, { confirmText, deleteFeedback });
    await accountSession.clear();
    if (userId) await (await getLocalStore(userId)).eraseAccountData();
    // DESIGN-GAP: Keep deletion completion in account state so the owner-switch projection reload cannot discard the confirmation screen's result.
    useAccount.setState({ pending: 0, lastSync: null, deleted: true });
    await usePreferences.persist.rehydrate();
  });
}
let mockProvider:
  | ((provider: 'apple' | 'google') => Promise<import('@tianji/api-client').MobileTokens>)
  | undefined;
/** Development-only mock transport for Maestro; production never enables mock identities. */
export async function configureAccountMock(
  fetcher: typeof fetch,
  provider: NonNullable<typeof mockProvider>,
  controls?: DiagnosticControls,
) {
  if (!__DEV__) throw new Error('E_FORBIDDEN');
  await syncFlight;
  await accountSession.clear();
  transport = fetcher;
  mockProvider = provider;
  diagnosticMock = controls;
  accountSession = createDiagnosticSession(fetcher);
  useAccount.setState({
    ready: true,
    busy: false,
    pending: 0,
    syncing: false,
    error: null,
    lastSync: null,
    mock: true,
    deleted: false,
  });
}

type DiagnosticControls = { setOffline: (value: boolean) => void; expire: () => void };
let diagnosticMock: DiagnosticControls | undefined;
function createDiagnosticSession(fetcher: typeof fetch) {
  return new SessionManager(undefined, fetcher, Date.now, () => {
    const session = accountSession.session;
    useAccount.setState({ session });
    if (!session) setCurrentOwner(null);
  });
}
/** Change only the development mock transport; production never exposes diagnostic controls. */
export function controlAccountMock(action: 'offline' | 'online' | 'expire') {
  if (!__DEV__ || !diagnosticMock) throw new Error('E_FORBIDDEN');
  if (action === 'expire') diagnosticMock.expire();
  else diagnosticMock.setOffline(action === 'offline');
}
