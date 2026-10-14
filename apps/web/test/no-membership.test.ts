import { afterEach, describe, expect, it, vi } from 'vitest';
import { featurePlan, membershipPlan } from '@tianji/shared/membership';
import {
  membershipEnabled,
  membershipPublicEnabled,
  ownerFeaturePlan,
  ownerMembershipPlan,
} from '../lib/membership';
import { canExport } from '../lib/report-export-schema';
import { webPaymentsEnabled } from '../lib/web-payments';
afterEach(() => vi.unstubAllEnvs());
describe('first release membership switch', () => {
  it.each([undefined, 'false', '1', 'TRUE'])(
    'fails closed for %s despite configured providers and old pro records',
    (value) => {
      vi.stubEnv('FEATURE_MEMBERSHIP', value);
      vi.stubEnv('NEXT_PUBLIC_FEATURE_MEMBERSHIP', value);
      vi.stubEnv('FEATURE_WEB_PAYMENTS', 'true');
      expect(membershipEnabled()).toBe(false);
      expect(membershipPublicEnabled()).toBe(false);
      expect(webPaymentsEnabled()).toBe(false);
      expect(ownerMembershipPlan('pro')).toBe('free');
      expect(ownerFeaturePlan('free')).toBe('pro');
      expect(canExport('free', false)).toBe(true);
    },
  );
  it('requires server and build opt-in and preserves normal tier behavior when enabled', () => {
    vi.stubEnv('FEATURE_MEMBERSHIP', 'true');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_MEMBERSHIP', 'false');
    expect(membershipEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_FEATURE_MEMBERSHIP', 'true');
    expect(membershipEnabled()).toBe(true);
    expect(ownerFeaturePlan('free')).toBe('free');
    expect(ownerMembershipPlan('pro')).toBe('pro');
    expect(canExport('free', false)).toBe(false);
    expect(canExport('pro', false)).toBe(true);
    expect(featurePlan('pro', true)).toBe('pro');
    expect(membershipPlan('free', true)).toBe('free');
  });
});
