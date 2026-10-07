import { create } from 'zustand';
import { accountSession, useAccount } from '../account/controller';
import {
  entitlementEndpoint,
  combinedAccess,
  freeAccess,
  purchaseCancelled,
  type Access,
  type ProductId,
} from './model';
import {
  createPurchasesProvider,
  revenuecatKey,
  type PurchaseProvider,
  type StoreProduct,
} from './purchases';
import type { MessageKey } from '../i18n';
interface BillingState {
  userId: string | null;
  status: 'loading' | 'ready' | 'error';
  access: Access;
  products: StoreProduct[];
  busy: boolean;
  configured: boolean;
  diagnostic: boolean;
  syncPending: boolean;
  message: MessageKey | null;
}
export const useBilling = create<BillingState>(() => ({
  userId: null,
  status: 'loading',
  access: freeAccess,
  products: [],
  busy: false,
  configured: false,
  diagnostic: false,
  syncPending: false,
  message: null,
}));
let provider: PurchaseProvider | undefined;
let currentUser: string | null = null;
let generation = 0;
let unsubscribe: (() => void) | undefined;
let queue = Promise.resolve();
let sdkAccess: Access = freeAccess;
let sdkExpiresAt: number | null = null;
function acceptSdk(access: Access) {
  sdkKnown = true;
  sdkAccess = access;
  // DESIGN-GAP: Fresh isActive may include grace beyond nominal expiry. Keep that result for five minutes; foreground refresh revalidates it, never extending a failed refresh.
  sdkExpiresAt =
    access.pro && !access.lifetime && access.until
      ? Math.max(
          Date.parse(access.until),
          (access.verifiedAt ?? Date.now()) + (Date.parse(access.until) <= Date.now() ? 300000 : 0),
        )
      : null;
  if (sdkExpiresAt !== null && sdkExpiresAt <= Date.now()) sdkAccess = freeAccess;
}
let serverAccess: Access = freeAccess;
let sdkKnown = false,
  serverKnown = false,
  identified = false;
let syncTransport = () => accountSession.request(entitlementEndpoint, {});
function serialize(work: () => Promise<void>) {
  const run = queue.then(work);
  queue = run.catch(() => undefined);
  return run;
}
function valid(user: string, epoch: number) {
  return user === currentUser && epoch === generation;
}
function apply(user: string, epoch: number) {
  if (!valid(user, epoch)) return;
  const access = combinedAccess(sdkAccess, serverAccess);
  useBilling.setState({
    access: { ...access },
    status: sdkKnown || serverKnown ? 'ready' : 'error',
  });
}
async function reconcile(user: string, epoch: number) {
  if (!valid(user, epoch)) return;
  try {
    const value = await syncTransport();
    if (!valid(user, epoch)) return;
    if (value.userId !== user) throw new Error('E_FORBIDDEN');
    serverKnown = true;
    serverAccess = {
      pro: value.plan === 'pro',
      lifetime: value.lifetime,
      until: value.revenuecatProUntil,
      renews: false,
    };
    // DESIGN-GAP: HTTP success can precede webhook propagation (or lack a server key); confirm the purchased tier before clearing the sync warning.
    useBilling.setState({
      syncPending:
        sdkAccess.pro && (value.plan !== 'pro' || (sdkAccess.lifetime && !value.lifetime)),
    });
  } catch {
    if (valid(user, epoch)) useBilling.setState({ syncPending: true });
  }
  apply(user, epoch);
}
async function loadSdk(user: string, epoch: number) {
  if (!provider || !valid(user, epoch)) return;
  try {
    if (!identified) {
      await provider.identify(user);
      if (!valid(user, epoch)) return;
      identified = true;
      useBilling.setState({ configured: true });
      unsubscribe = provider.listen((access) => {
        if (!valid(user, epoch)) return;
        acceptSdk(access);
        apply(user, epoch);
        void serialize(() => reconcile(user, epoch));
      });
    }
    const access = await provider.refresh();
    if (!valid(user, epoch)) return;
    acceptSdk(access);
    if (useBilling.getState().products.length < 2) {
      const offerings = await provider.offerings();
      if (!valid(user, epoch)) return;
      useBilling.setState({ products: offerings });
    }
  } catch {
    if (valid(user, epoch)) useBilling.setState({ message: 'mobile.billing.error' });
  }
}
/** Bind all SDK/network results to one account generation, immediately hiding prior account access. */
export function identifyBilling(userId: string | null) {
  currentUser = userId;
  const epoch = ++generation;
  unsubscribe?.();
  unsubscribe = undefined;
  sdkAccess = freeAccess;
  sdkExpiresAt = null;
  serverAccess = freeAccess;
  sdkKnown = false;
  serverKnown = false;
  identified = false;
  useBilling.setState({
    userId,
    access: freeAccess,
    status: userId ? 'loading' : 'ready',
    products: [],
    busy: false,
    configured: false,
    syncPending: false,
    message: null,
  });
  return serialize(async () => {
    if (!userId || !valid(userId, epoch)) return;
    if (!provider && !useAccount.getState().mock) {
      const key = revenuecatKey();
      if (key) provider = createPurchasesProvider(key);
    }
    await loadSdk(userId, epoch);
    if (valid(userId, epoch)) await reconcile(userId, epoch);
  });
}
/** Refresh StoreKit/Play and Worker rights on foreground, account change and explicit retry. */
export function refreshBilling() {
  const user = currentUser,
    epoch = generation;
  return serialize(async () => {
    if (!user || !valid(user, epoch)) return;
    useBilling.setState({ message: null });
    await loadSdk(user, epoch);
    if (valid(user, epoch)) await reconcile(user, epoch);
  });
}
/** Store purchase/restore never accepts a client entitlement as a server grant. Failed sync remains retryable. */
export function billingAction(action: 'restore' | 'manage' | ProductId) {
  const user = currentUser,
    epoch = generation;
  if (!user || !provider || !identified || useBilling.getState().busy) return Promise.resolve();
  useBilling.setState({ busy: true, message: null });
  return serialize(async () => {
    try {
      if (!valid(user, epoch) || !provider) return;
      if (action === 'manage') {
        await provider.manage();
        return;
      }
      const access =
        action === 'restore' ? await provider.restore() : await provider.purchase(action);
      if (!valid(user, epoch)) return;
      acceptSdk(access);
      // Display the verified SDK result immediately; retry Worker propagation independently.
      apply(user, epoch);
      useBilling.setState({
        message:
          action === 'restore'
            ? access.pro
              ? 'mobile.billing.restored'
              : 'mobile.billing.emptyRestore'
            : access.pro
              ? 'mobile.billing.purchased'
              : 'mobile.billing.pending',
      });
      await reconcile(user, epoch);
    } catch (error) {
      if (valid(user, epoch))
        useBilling.setState({
          message: purchaseCancelled(error) ? 'mobile.billing.cancelled' : 'mobile.billing.error',
        });
    } finally {
      if (valid(user, epoch)) useBilling.setState({ busy: false });
    }
  });
}
/** Expired cached monthly rights cannot keep ads hidden indefinitely while offline. */
export function expireBilling(now = Date.now()) {
  const nativeExpired = sdkExpiresAt !== null && sdkExpiresAt <= now;
  const serverExpired =
    !serverAccess.lifetime && serverAccess.until !== null && Date.parse(serverAccess.until) <= now;
  if (!nativeExpired && !serverExpired) return;
  if (nativeExpired) {
    sdkAccess = freeAccess;
    sdkExpiresAt = null;
  }
  if (serverExpired) serverAccess = freeAccess;
  if (currentUser) apply(currentUser, generation);
}
/** Explicit development fixture injection, never enabled automatically by a missing API key. */
export async function configureBillingDiagnostic(
  mock: PurchaseProvider,
  sync: typeof syncTransport,
) {
  if (!__DEV__) throw new Error('E_FORBIDDEN');
  await queue;
  provider = mock;
  syncTransport = sync;
  useBilling.setState({ diagnostic: true });
}
