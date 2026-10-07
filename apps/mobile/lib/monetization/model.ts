import { z } from 'zod';
import type { ApiEndpoint } from '@tianji/api-client';
import type { CustomerInfo } from 'react-native-purchases';
export const products = ['tianji_pro_monthly', 'tianji_pro_lifetime'] as const;
export type ProductId = (typeof products)[number];
export interface Access {
  pro: boolean;
  lifetime: boolean;
  until: string | null;
  renews: boolean;
  verifiedAt?: number;
}
export const freeAccess: Access = { pro: false, lifetime: false, until: null, renews: false };
const input = z.object({}).strict();
const output = z.object({
  userId: z.string().min(1),
  plan: z.enum(['free', 'pro']),
  lifetime: z.boolean(),
  revenuecatProUntil: z.string().datetime().nullable(),
});
// DESIGN-GAP: The existing M09 response contract is consumed through api-client's typed transport without changing shared package behavior.
export const entitlementEndpoint = {
  path: '/api/v1/mobile/entitlements/sync',
  method: 'POST',
  input,
  output,
  encode: () => ({ body: {} }),
} satisfies ApiEndpoint<typeof input, typeof output>;
/** Only the active documented pro entitlement grants access; expiration includes SDK grace handling. */
export function customerAccess(
  info: Pick<CustomerInfo, 'entitlements'> & Partial<Pick<CustomerInfo, 'requestDate'>>,
): Access {
  const entitlement = info.entitlements.active.pro;
  if (!entitlement?.isActive) return { ...freeAccess };
  const until = entitlement.expirationDate;
  // RevenueCat's isActive includes store grace periods; do not reclassify a fresh grace entitlement using its nominal expiry.
  return {
    pro: true,
    lifetime: until === null,
    until,
    renews: entitlement.willRenew,
    // DESIGN-GAP: RevenueCat requestDate bounds cached grace freshness; reading offline cache cannot indefinitely renew it.
    ...(info.requestDate ? { verifiedAt: Date.parse(info.requestDate) } : {}),
  };
}
/** Retain the strongest verified access across native stores and existing Web billing. */
export function combinedAccess(native: Access, server: Access): Access {
  const active = [native, server].filter((value) => value.pro);
  if (!active.length) return { ...freeAccess };
  if (active.some((value) => value.lifetime))
    return { pro: true, lifetime: true, until: null, renews: false };
  // DESIGN-GAP: Legacy Stripe access has no RevenueCat expiry; its verified server plan remains authoritative until the next refresh.
  const until = active.some((value) => value.until === null)
    ? null
    : (active
        .map((value) => value.until)
        .sort()
        .at(-1) ?? null);
  return { pro: true, lifetime: false, until, renews: native.pro && native.renews };
}
/** Identify user cancellation without leaking store error text into UI or logs. */
export function purchaseCancelled(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'userCancelled' in error &&
    error.userCancelled === true
  );
}
