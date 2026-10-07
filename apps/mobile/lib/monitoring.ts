import * as Sentry from '@sentry/react-native';
import type { ErrorEvent, StackFrame } from '@sentry/react-native';

export type MobileMetric = 'startup.js_ready_ms' | 'starfield.fps' | 'history.fps';
const metrics = new Set<string>(['startup.js_ready_ms', 'starfield.fps', 'history.fps']);
/** Strip dates and all URL values from code locations, including repeatedly encoded deep links. */
function codeLocation(value: string | undefined): string | undefined {
  if (!value) return value;
  for (let i = 0; i < 3; i++) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return '[REDACTED]';
    }
  }
  return value
    .replace(/[?#].*/, '')
    .replace(/\d{4}-\d{2}-\d{2}/g, '[REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+/g, '[REDACTED]')
    .replace(/(?:file:\/\/)?\/(?:Users|home)\/[^/]+/g, '/[REDACTED]');
}
function frame(value: StackFrame): StackFrame {
  return {
    filename: codeLocation(value.filename),
    function: codeLocation(value.function),
    module: codeLocation(value.module),
    lineno: value.lineno,
    colno: value.colno,
    in_app: value.in_app,
    platform: value.platform,
    instruction_addr: value.instruction_addr,
    addr_mode: value.addr_mode,
    debug_id: value.debug_id,
  };
}
/** Allow only technical crash structure and explicit numeric metrics; never serialize arbitrary application state. */
export function beforeSend(event: ErrorEvent): ErrorEvent {
  // DESIGN-GAP: Free-form error text can contain unlabelled questions/birthplaces; replace it instead of relying only on regex redaction.
  const metric = event.extra?.metric;
  const value = event.extra?.value;
  const isMetric =
    typeof metric === 'string' &&
    metrics.has(metric) &&
    typeof value === 'number' &&
    Number.isFinite(value);
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: codeLocation(event.release),
    dist: event.dist,
    environment: event.environment,
    sdk: event.sdk,
    debug_meta: event.debug_meta && {
      images: event.debug_meta.images?.map((image) =>
        image.type === 'macho'
          ? {
              type: 'macho' as const,
              debug_id: image.debug_id,
              image_addr: image.image_addr,
              image_size: image.image_size,
              code_file: codeLocation(image.code_file),
            }
          : {
              type: image.type,
              debug_id: image.debug_id,
              code_file: codeLocation(image.code_file) ?? '',
            },
      ),
    },
    message: isMetric ? metric : 'Mobile exception',
    extra: isMetric ? { metric, value } : undefined,
    exception: event.exception && {
      values: event.exception.values?.map((exception) => ({
        type: exception.type?.match(/^[A-Za-z][A-Za-z0-9_.]{0,80}$/)?.[0] ?? 'Error',
        value: 'Mobile exception',
        mechanism: exception.mechanism && {
          type: exception.mechanism.type,
          handled: exception.mechanism.handled,
        },
        stacktrace: exception.stacktrace && { frames: exception.stacktrace.frames?.map(frame) },
      })),
    },
    // No request, user, contexts, breadcrumbs, tags, attachments, thread locals or arbitrary extras cross this boundary.
  };
}

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
// DESIGN-GAP: Native crash handling remains active only with a provisioned DSN; local/audit builds never send synthetic diagnostics.
Sentry.init({
  dsn,
  enabled: Boolean(dsn) && !__DEV__ && process.env.EXPO_PUBLIC_M14_AUDIT !== 'true',
  sendDefaultPii: false,
  maxBreadcrumbs: 0,
  enableAutoBreadcrumbTracking: false,
  enableNetworkBreadcrumbs: false,
  enableNetworkEventBreadcrumbs: false,
  enableActivityLifecycleBreadcrumbs: false,
  enableAppLifecycleBreadcrumbs: false,
  enableSystemEventBreadcrumbs: false,
  enableAppComponentBreadcrumbs: false,
  enableCaptureFailedRequests: false,
  enableAutoPerformanceTracing: false,
  enableUserInteractionTracing: false,
  enableLogs: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  reportAccessibilityIdentifier: false,
  tracesSampleRate: 0,
  beforeSend,
  beforeSendTransaction: () => null,
  beforeBreadcrumb: () => null,
  integrations: (defaults) =>
    defaults.filter(
      (integration) =>
        ![
          'Breadcrumbs',
          'HttpContext',
          'ExpoContext',
          'ExpoConstants',
          'Screenshot',
          'ViewHierarchy',
          'MobileReplay',
        ].includes(integration.name),
    ),
});
/** Send a finite, named aggregate without profiles, coordinates, route parameters or UI copy. */
export function captureMetric(metric: MobileMetric, value: number) {
  if (!Number.isFinite(value) || value < 0) return;
  Sentry.captureEvent({ level: 'info', extra: { metric, value } });
}
