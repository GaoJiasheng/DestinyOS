import { BirthInputSchema } from '@tianji/shared';
import Purchases, { type PurchasesEntitlementInfo } from 'react-native-purchases';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { adAge, reportAdSlot } from '../lib/monetization/ad-policy';
import {
  customerAccess,
  combinedAccess,
  freeAccess,
  entitlementEndpoint,
} from '../lib/monetization/model';

const monthly = { pro: true, lifetime: false, until: '2027-01-01T00:00:00Z', renews: true };
const lifetime = { pro: true, lifetime: true, until: null, renews: false };
it('only active pro grants membership, including non-renewing subscriptions and grace', () => {
  const pro = {
    isActive: true,
    expirationDate: monthly.until,
    willRenew: false,
  } as PurchasesEntitlementInfo;
  expect(
    customerAccess({
      entitlements: {
        active: {},
        all: {},
        verification: Purchases.VERIFICATION_RESULT.NOT_REQUESTED,
      },
    }),
  ).toEqual(freeAccess);
  const info = {
    entitlements: {
      active: { pro },
      all: { pro },
      verification: Purchases.VERIFICATION_RESULT.NOT_REQUESTED,
    },
  };
  expect(customerAccess(info)).toEqual({ ...monthly, renews: false });
  expect(
    customerAccess({
      entitlements: { ...info.entitlements, active: { pro: { ...pro, expirationDate: null } } },
    }),
  ).toEqual(lifetime);
  expect(
    customerAccess({
      entitlements: { ...info.entitlements, active: { pro: { ...pro, isActive: false } } },
    }),
  ).toEqual(freeAccess);
});
it('merges lifetime, store grace, and legacy Stripe without downgrading the stronger access', () => {
  expect(combinedAccess(monthly, lifetime)).toEqual(lifetime);
  expect(combinedAccess(lifetime, monthly)).toEqual(lifetime);
  expect(
    combinedAccess(monthly, { ...monthly, until: '2028-01-01T00:00:00Z', renews: false }).until,
  ).toBe('2028-01-01T00:00:00Z');
  expect(combinedAccess(monthly, { ...monthly, until: null }).until).toBeNull();
  expect(combinedAccess(freeAccess, freeAccess)).toEqual(freeAccess);
});
it('uses a strict empty-body entitlement refresh, never accepting a client grant', () => {
  expect(entitlementEndpoint.path).toBe('/api/v1/mobile/entitlements/sync');
  expect(entitlementEndpoint.input.safeParse({ plan: 'pro' }).success).toBe(false);
  expect(entitlementEndpoint.encode()).toEqual({ body: {} });
});
const profile = (year: number, relation: 'self' | 'partner' = 'self') => ({
  data: {
    name: '',
    relation,
    birth: BirthInputSchema.parse({ ...A, year }),
    version: 1,
    isCurrent: true as const,
  },
});
it('neutral age gating uses only self profiles, birthdays and the most restrictive household age', () => {
  const date = new Date('2026-10-07T00:00:00Z');
  expect(adAge([], false, date)).toBe('unknown');
  expect(adAge([profile(1990)], true, date)).toBe('blocked');
  expect(adAge([profile(2015)], false, date)).toBe('blocked');
  expect(adAge([profile(2011)], false, date)).toBe('teen');
  expect(adAge([profile(1990), profile(2011)], false, date)).toBe('teen');
  expect(adAge([profile(1990), profile(2015, 'partner')], false, date)).toBe('adult');
  const birthday = {
    ...profile(2008),
    data: {
      ...profile(2008).data,
      birth: BirthInputSchema.parse({ ...A, year: 2008, month: 10, day: 8 }),
    },
  };
  expect(adAge([birthday], false, date)).toBe('teen');
  expect(adAge([birthday], false, new Date('2026-10-08'))).toBe('adult');
});
it('limits each report to two independent slots between chapters', () => {
  for (const count of [0, 1, 2, 3, 6, 7, 30]) {
    const slots = Array.from({ length: count }, (_, index) => reportAdSlot(index, count)).filter(
      (value) => value !== null,
    );
    expect(slots.length).toBeLessThanOrEqual(2);
    expect(new Set(slots).size).toBe(slots.length);
  }
  expect(reportAdSlot(1, 2)).toBeNull();
  expect(reportAdSlot(1, 3)).toBe(0);
  expect(reportAdSlot(5, 7)).toBe(1);
});
