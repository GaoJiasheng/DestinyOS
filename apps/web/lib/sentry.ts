import type { ErrorEvent } from '@sentry/nextjs';
import { sanitize } from './privacy';

/** Sentry boundary: remove request payloads, retain only the user ID, and scrub all remaining telemetry. */
export function beforeSend(event: ErrorEvent): ErrorEvent {
  const clean: ErrorEvent = { ...event };
  if (clean.request) {
    clean.request = { ...clean.request };
    delete clean.request.data;
    // DESIGN-GAP: Drop headers and cookies entirely; Auth tokens must never reach monitoring.
    delete clean.request.headers;
    delete clean.request.cookies;
  }
  if (clean.user) clean.user = clean.user.id ? { id: clean.user.id } : {};
  return sanitize(clean) as ErrorEvent;
}
