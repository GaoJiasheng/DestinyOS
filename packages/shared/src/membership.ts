/** Resolve membership identity without changing persisted purchase records. */
export function membershipPlan(plan: 'free' | 'pro', enabled: boolean): 'free' | 'pro' {
  return enabled ? plan : 'free';
}
/** First release grants signed-in users the former member feature limits. Call only after authentication. */
export function featurePlan(plan: 'free' | 'pro', enabled: boolean): 'free' | 'pro' {
  return enabled ? plan : 'pro';
}
