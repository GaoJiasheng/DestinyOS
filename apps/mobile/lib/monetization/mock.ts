import { freeAccess, type Access, type ProductId } from './model';
import type { PurchaseProvider } from './purchases';
/** Isolated test adapter; it cannot grant access to the Worker or RevenueCat dashboard. */
export function createBillingMock() {
  if (!__DEV__) throw new Error('E_FORBIDDEN');
  let user = '',
    access: Access = freeAccess,
    saved: Access = freeAccess;
  let next: 'success' | 'error' | 'cancel' = 'success',
    syncError = false;
  let changed: ((access: Access) => void) | undefined;
  const provider: PurchaseProvider = {
    async identify(id) {
      user = id;
    },
    async offerings() {
      return [
        { id: 'tianji_pro_monthly', price: 'US$2.99' },
        { id: 'tianji_pro_lifetime', price: 'US$6.99' },
      ];
    },
    async refresh() {
      return access;
    },
    async purchase(id: ProductId) {
      const result = next;
      next = 'success';
      if (result === 'cancel') throw { userCancelled: true };
      if (result === 'error') throw new Error('TEST_PAYMENT_FAILURE');
      access = {
        pro: true,
        lifetime: id === 'tianji_pro_lifetime',
        until: id === 'tianji_pro_lifetime' ? null : new Date(Date.now() + 86400000).toISOString(),
        renews: id !== 'tianji_pro_lifetime',
      };
      saved = access;
      return access;
    },
    async restore() {
      access = saved;
      return access;
    },
    listen(listener) {
      changed = listener;
      return () => {
        changed = undefined;
      };
    },
    async manage() {},
  };
  return {
    provider,
    async sync() {
      if (syncError) throw new Error('TEST_NETWORK_FAILURE');
      return {
        userId: user,
        plan: access.pro ? ('pro' as const) : ('free' as const),
        lifetime: access.lifetime,
        revenuecatProUntil: access.until,
      };
    },
    fail(value: typeof next) {
      next = value;
    },
    syncError(value: boolean) {
      syncError = value;
    },
    revoke() {
      saved = freeAccess;
      access = freeAccess;
      changed?.(access);
    },
    clearDevice() {
      access = freeAccess;
      changed?.(access);
    },
  };
}
