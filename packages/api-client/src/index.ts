import { z } from 'zod';
import {
  ApiFailureSchema,
  apiSuccessSchema,
  GeoSearchRequestSchema,
  GeoSearchResponseSchema,
  GeoTimezoneRequestSchema,
  GeoTimezoneResponseSchema,
} from '@tianji/shared';

export type ApiEndpoint<I extends z.ZodType<unknown>, O extends z.ZodType<unknown>> = {
  path: `/api/v1/${string}`;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  input: I;
  output: O;
  encode: (input: z.output<I>) => { query?: Record<string, string>; body?: unknown };
};
export type RequestOptions = { signal?: AbortSignal; idempotencyKey?: string };
export type ApiClientOptions = {
  /** Empty for same-origin Web requests; mobile supplies the first-party HTTPS origin. */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** Read the current token per request; persistence and refresh belong to the platform adapter. */
  accessToken?: () => string | undefined | Promise<string | undefined>;
};

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

export const geoSearchEndpoint = {
  path: '/api/v1/geo/search',
  method: 'GET',
  input: GeoSearchRequestSchema,
  output: GeoSearchResponseSchema,
  encode: (input) => ({ query: { q: input.q, locale: input.locale } }),
} satisfies ApiEndpoint<typeof GeoSearchRequestSchema, typeof GeoSearchResponseSchema>;
export const geoTimezoneEndpoint = {
  path: '/api/v1/geo/tz',
  method: 'GET',
  input: GeoTimezoneRequestSchema,
  output: GeoTimezoneResponseSchema,
  encode: (input) => ({ query: { lat: String(input.lat), lng: String(input.lng) } }),
} satisfies ApiEndpoint<typeof GeoTimezoneRequestSchema, typeof GeoTimezoneResponseSchema>;

/** Create a platform-independent JSON client using shared Zod contracts; never retries mutations. */
export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl?.replace(/\/$/, '') ?? '';
  // DESIGN-GAP: Web uses a relative origin; native injects its first-party HTTPS origin (HTTP is allowed only for local development).
  if (baseUrl) {
    const url = new URL(baseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    )
      throw new Error('Invalid API origin');
  }

  /** Validate input before transport and output before exposing data; signal and idempotency pass through. */
  async function request<I extends z.ZodType<unknown>, O extends z.ZodType<unknown>>(
    endpoint: ApiEndpoint<I, O>,
    input: z.input<I>,
    requestOptions: RequestOptions = {},
  ): Promise<z.output<O>> {
    const parsed = endpoint.input.safeParse(input);
    if (!parsed.success) throw new ApiClientError('E_VALIDATION', 0, 'validation');
    const encoded = endpoint.encode(parsed.data);
    const query = encoded.query ? `?${new URLSearchParams(encoded.query)}` : '';
    const token = await options.accessToken?.();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (requestOptions.idempotencyKey) headers['Idempotency-Key'] = requestOptions.idempotencyKey;
    if (encoded.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await (options.fetch ?? globalThis.fetch)(
      `${baseUrl}${endpoint.path}${query}`,
      {
        method: endpoint.method,
        headers,
        credentials: baseUrl || options.accessToken ? 'omit' : 'same-origin',
        signal: requestOptions.signal,
        ...(encoded.body !== undefined ? { body: JSON.stringify(encoded.body) } : {}),
      },
    );
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new ApiClientError('E_INTERNAL', response.status, 'decode');
    }
    const failure = ApiFailureSchema.safeParse(raw);
    if (failure.success) {
      const header = response.headers.get('Retry-After');
      const seconds = header === null ? undefined : Number(header);
      throw new ApiClientError(
        failure.data.error.code,
        response.status,
        'api',
        failure.data.error.details,
        seconds !== undefined && Number.isFinite(seconds) ? seconds : undefined,
      );
    }
    const success = apiSuccessSchema(endpoint.output).safeParse(raw);
    if (!response.ok || !success.success)
      throw new ApiClientError('E_INTERNAL', response.status, 'response');
    return success.data.data;
  }
  return {
    request,
    searchCities: (input: z.input<typeof GeoSearchRequestSchema>, opts?: RequestOptions) =>
      request(geoSearchEndpoint, input, opts),
    lookupTimezone: (input: z.input<typeof GeoTimezoneRequestSchema>, opts?: RequestOptions) =>
      request(geoTimezoneEndpoint, input, opts),
  };
}

export * from './mobile';
