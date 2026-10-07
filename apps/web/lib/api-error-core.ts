// DESIGN-GAP: Media and transport errors share the API error class without loading engine error mapping.
/** Uniform API failure with an English developer message and optional structured details. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
