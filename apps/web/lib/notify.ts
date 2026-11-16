/**
 * One place for transient confirmations. Success that needs no follow-up goes here; failures and
 * anything the user must act on stay inline with `role="alert"` next to the control that caused them.
 */
// DESIGN-GAP: sonner loads lazily so the notification host stays out of the shell JS budget; calls made before the host mounts are queued by sonner itself.
function show(kind: 'success' | 'message', message: string) {
  void import('sonner')
    .then(({ toast }) => (kind === 'success' ? toast.success(message) : toast(message)))
    .catch(() => undefined);
}

/** Confirm a finished action (saved, copied, deleted, imported). */
export function notifySuccess(message: string) {
  show('success', message);
}

/** Neutral heads-up that needs no action (for example, old local readings were evicted). */
export function notifyInfo(message: string) {
  show('message', message);
}
