// DESIGN-GAP: Test-process-only HTTP interception exercises the real Stripe SDK/actions without production payment bypasses.
const endpoint = new URL(process.env.TEST_STRIPE_URL ?? '');
if (
  process.env.TEST_STRIPE_MOCK !== '1' ||
  process.env.STRIPE_SECRET_KEY !== 'sk_test_m4' ||
  endpoint.hostname !== '127.0.0.1'
)
  throw new Error('Stripe interception requires isolated test configuration');
const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.hostname !== 'api.stripe.com') return originalFetch(request);
  const target = new URL(`${url.pathname}${url.search}`, endpoint);
  return originalFetch(new Request(target, request));
};
