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

/** Convert a known failure to the documented JSON envelope and Retry-After header. */
export function errorResponse(error: ApiError): Response {
  const retryAfter = error.details?.retryAfter;
  return Response.json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    {
      status: error.status,
      headers: typeof retryAfter === 'number' ? { 'Retry-After': String(retryAfter) } : undefined,
    },
  );
}
