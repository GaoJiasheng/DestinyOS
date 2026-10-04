import { beforeSend } from './lib/sentry';
import { sanitize } from './lib/privacy';
// DESIGN-GAP: The optional browser DSN is public; the server DSN remains server-only.
// DESIGN-GAP: Load the browser SDK asynchronously to keep the initial page bundle within the JS budget.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import('@sentry/nextjs').then((Sentry) =>
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        stackFrameVariables: false,
      },
      beforeSend,
      beforeBreadcrumb: (breadcrumb) => sanitize(breadcrumb) as typeof breadcrumb,
    }),
  );
}
/** Forward client navigation telemetry only when browser monitoring is configured. */
export function onRouterTransitionStart(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    void import('@sentry/nextjs').then((Sentry) => Sentry.captureRouterTransitionStart(...args));
  }
}
