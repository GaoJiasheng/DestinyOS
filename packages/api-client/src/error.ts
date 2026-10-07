/** Failure exposes codes/status for localized UI, without retaining URLs, inputs, or raw responses. */
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly kind: 'validation' | 'response' | 'decode' | 'api',
    public readonly details?: Record<string, unknown>,
    public readonly retryAfter?: number,
  ) {
    super('API request failed');
    this.name = 'ApiClientError';
  }
}
