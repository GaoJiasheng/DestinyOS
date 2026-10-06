import { platform } from './platform/environment';
import { cloudflareBindings } from './platform/cloudflare';
import { stateRead, stateWrite } from './state';
import type { CircuitStore } from './platform/circuit-gate';
/** Resolve durable KV state; local Node uses the isolated database cache substitute. */
export async function circuitStore(): Promise<CircuitStore> {
  if (platform() === 'cloudflare') return (await cloudflareBindings()).CACHE;
  return {
    get: (key) => stateRead(`kv:${key}`),
    put: (key, value) => stateWrite(`kv:${key}`, value, 400 * 86400),
  };
}
/** Persist the administrator's explicit override without an expiring cache. */
export async function setCircuitMode(mode: 'auto' | 'open' | 'closed'): Promise<void> {
  await (await circuitStore()).put('circuit:mode', mode);
}
