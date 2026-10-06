export interface Usage {
  requests: number;
  cpuMs: number;
}
export interface CircuitState {
  cycle: string;
  open: boolean;
  notified: string[];
}
export const includedUsage: Usage = { requests: 10_000_000, cpuMs: 30_000_000 };
/** UTC billing window, clamping start days to each month's final day. */
// DESIGN-GAP: Billing starts on CF_BILLING_CYCLE_DAY (default 1); Owner matches this to the Cloudflare invoice cycle.
export function billingCycleStart(now: Date, day = 1): Date {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Invalid billing cycle day');
  const start = (year: number, month: number) =>
    new Date(
      Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())),
    );
  const current = start(now.getUTCFullYear(), now.getUTCMonth());
  return now >= current ? current : start(now.getUTCFullYear(), now.getUTCMonth() - 1);
}
/** Open above either 90% limit; recover only below both 80% limits, or on a new cycle. */
export function nextCircuit(
  previous: CircuitState | null,
  cycle: string,
  usage: Usage,
): CircuitState {
  const high =
    usage.requests > includedUsage.requests * 0.9 || usage.cpuMs > includedUsage.cpuMs * 0.9;
  const low =
    usage.requests < includedUsage.requests * 0.8 && usage.cpuMs < includedUsage.cpuMs * 0.8;
  const same = previous?.cycle === cycle;
  return {
    cycle,
    open: high || Boolean(same && previous?.open && !low),
    notified: same ? previous.notified : [],
  };
}
