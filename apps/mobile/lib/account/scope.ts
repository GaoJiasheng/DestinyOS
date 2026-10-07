// DESIGN-GAP: Default repository scope follows the restored mobile identity; explicit null always accesses anonymous data.
let owner: string | null = null;
const listeners = new Set<() => void>();
/** Read the current local owner without importing native authentication into repositories. */
export const currentOwner = () => owner;
/** Change owner and notify data projections after credential persistence succeeds. */
export function setCurrentOwner(value: string | null) {
  owner = value;
  listeners.forEach((listener) => listener());
}
/** Observe account switches for profile and settings reloads. */
export function subscribeOwner(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
