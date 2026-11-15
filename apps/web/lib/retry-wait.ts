/** ICU arguments for `common.retryAfterWait`: seconds under a minute, otherwise whole minutes rounded up. */
export function retryWait(retryAfter: number | undefined): {
  unit: 'seconds' | 'minutes';
  count: number;
} {
  const seconds =
    typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.ceil(retryAfter)
      : 1;
  return seconds < 60
    ? { unit: 'seconds', count: seconds }
    : { unit: 'minutes', count: Math.ceil(seconds / 60) };
}

/** Read the optional wait from any action failure, including envelopes typed without it. */
export function failureRetryAfter(error: { code: string }): number | undefined {
  const value = 'retryAfter' in error ? error.retryAfter : undefined;
  return typeof value === 'number' ? value : undefined;
}
