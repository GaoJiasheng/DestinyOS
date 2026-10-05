/** Security headers apply to public, account, admin and API responses. */
export function securityHeaders() {
  return [
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  ];
}
// DESIGN-GAP: The docs omit a CSP report URI; /api/v1/csp/report collects sanitized hostnames and directives.
/** Collect CSP violations before enforcement; a fresh request nonce covers Next.js inline scripts. */
export function reportOnlyCsp(nonce: string, development = false): string {
  // DESIGN-GAP: Next.js dev evaluates bundled modules; allow eval only there to prevent diagnostic report floods from starving hydration and server actions.
  const evaluation = development ? " 'unsafe-eval'" : '';
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}'${evaluation} https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://js.stripe.com; frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.google.com https://js.stripe.com https://checkout.stripe.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.google.com https://*.googlesyndication.com https://api.stripe.com https://*.ingest.sentry.io; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; report-uri /api/v1/csp/report`;
}
