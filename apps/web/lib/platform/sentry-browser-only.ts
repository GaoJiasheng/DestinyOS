// DESIGN-GAP: Client error boundaries are also SSR-compiled; replace their browser SDK imports only in server bundles.
/** Client monitoring initializes only in the real browser bundle. */
export function init(): void {}
/** Workers Observability owns server errors. */
export function captureException(): void {}
/** Browser-only transition telemetry is never recorded during SSR. */
export function captureRouterTransitionStart(): void {}
