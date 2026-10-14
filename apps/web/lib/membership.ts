import { featurePlan, membershipPlan } from '@tianji/shared/membership';
/** Build-time public switch controls client entry points; default is disabled. */
export function membershipPublicEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_MEMBERSHIP === 'true';
}
/** Both server and public build must opt in, preventing a runtime-only partial rollout. */
export function membershipEnabled(): boolean {
  // DESIGN-GAP: Require both flags to enable membership so cached public pages and server rights stay aligned.
  return process.env.FEATURE_MEMBERSHIP === 'true' && membershipPublicEnabled();
}
/** Former member limits are available to every authenticated owner while membership is disabled. */
export function ownerFeaturePlan(plan: 'free' | 'pro'): 'free' | 'pro' {
  return featurePlan(plan, membershipEnabled());
}
/** Disabled membership always reports a free identity. */
export function ownerMembershipPlan(plan: 'free' | 'pro'): 'free' | 'pro' {
  return membershipPlan(plan, membershipEnabled());
}
