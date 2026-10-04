import { EngineErrorCode } from '@tianji/shared';
// DESIGN-GAP: Engine codes use engine.errors.<code> and engine.warnings.<code> next-intl namespaces.
export const ERROR_MESSAGE_KEYS: Record<EngineErrorCode, string> = Object.fromEntries(
  Object.values(EngineErrorCode).map((code) => [code, `engine.errors.${code}`]),
) as Record<EngineErrorCode, string>;
export class EngineError extends Error {
  /** Creates a transport-safe error; details must never contain raw birth input. */
  constructor(
    public readonly code: EngineErrorCode,
    message = ERROR_MESSAGE_KEYS[code],
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}
