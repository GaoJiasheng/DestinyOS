/** Notify the persistent navigation surface before React schedules a route transition. */
export function navigationStarted(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tianji-navigation-start'));
}

/** Complete a refresh that preserves the current pathname. */
export function navigationFinished(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tianji-navigation-finish'));
}
