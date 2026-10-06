export interface CircuitStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
/** Persisted manual mode overrides automatic state; no in-process cache can hide a new trip. */
export async function circuitOpen(store: CircuitStore): Promise<boolean> {
  // DESIGN-GAP: Both live KV keys are read concurrently; retain immediate manual-mode precedence without an isolate cache.
  const [mode, state] = await Promise.all([store.get('circuit:mode'), store.get('circuit')]);
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  return state === 'open';
}
/** Only essential admin/auth/cron and signed payment callbacks bypass the cost gate. */
// DESIGN-GAP: Keep admin recovery, auth, health, Cron and RevenueCat callbacks reachable; all public actions and renderers receive 503 before Next.js dispatch.
export function circuitBypass(path: string): boolean {
  return (
    /^\/admin(?:\/|$)/.test(path) ||
    /^\/(?:zh|zh-TW|en)\/auth(?:\/|$)/.test(path) ||
    /^\/api\/auth(?:\/|$)/.test(path) ||
    /^\/api\/v1\/(?:health\/?|cron\/(?:daily-maintenance|cost-circuit)\/?|mobile\/webhooks\/revenuecat\/?)$/.test(
      path,
    )
  );
}
