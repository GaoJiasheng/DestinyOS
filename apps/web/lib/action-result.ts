import { actionError, actionRetryAfter } from './api-error';
/** Failure envelope; `retryAfter` (seconds) is present only for rate-limited work. */
export type ActionFailure = { code: string; retryAfter?: number };
// DESIGN-GAP: ActionResult lives in reading-schema; this structural subtype adds the optional wait without changing every caller.
export type RetryableActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionFailure };
/** Resolve work to the public action envelope, exposing only a domain code on failure.
 * @param work Validated application operation.
 * @param onError Optional existing boundary side effect, executed before returning a failure.
 */
export async function runAction<T>(
  work: () => Promise<T>,
  onError?: (code: string) => Promise<void>,
): Promise<RetryableActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    const code = actionError(error);
    const retryAfter = actionRetryAfter(error);
    await onError?.(code);
    return { ok: false, error: retryAfter ? { code, retryAfter } : { code } };
  }
}
