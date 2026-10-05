import { actionError } from './api-error';
import type { ActionResult } from './reading-schema';
/** Resolve work to the public action envelope, exposing only a domain code on failure.
 * @param work Validated application operation.
 * @param onError Optional existing boundary side effect, executed before returning a failure.
 */
export async function runAction<T>(
  work: () => Promise<T>,
  onError?: (code: string) => Promise<void>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    const code = actionError(error);
    await onError?.(code);
    return { ok: false, error: { code } };
  }
}
