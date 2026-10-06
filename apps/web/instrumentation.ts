/** Initialize the appropriate server monitoring runtime without loading Node modules on Edge. */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config');
}

// DESIGN-GAP: Disabled monitoring must not initialize its SDK during isolate startup.
export const onRequestError: typeof import('@sentry/nextjs').captureRequestError = async (
  ...args
) => {
  if (process.env.SENTRY_DSN) (await import('@sentry/nextjs')).captureRequestError(...args);
};
