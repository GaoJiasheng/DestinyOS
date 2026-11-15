import { isLocale } from '@/i18n/routing';
const prefix = 'tianji.draft.';
// Drafts live in sessionStorage only: they survive a same-tab reload (such as a locale switch) and vanish with the tab.
/** Read a draft saved for the same starting data; a changed basis (for example a newer saved profile) discards it. */
export function readDraft<T>(key: string, basis: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(prefix + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { basis?: unknown; data?: unknown };
    return parsed.basis === basis && parsed.data && typeof parsed.data === 'object'
      ? (parsed.data as T)
      : null;
  } catch {
    return null;
  }
}
/** Persist an unsent draft; storage failures (private mode, quota) are non-fatal. */
export function writeDraft(key: string, basis: string, data: unknown) {
  try {
    window.sessionStorage.setItem(prefix + key, JSON.stringify({ basis, data }));
  } catch {
    // Drafts are a convenience; the form keeps working without them.
  }
}
/** Remove a draft after a successful submission. */
export function clearDraft(key: string) {
  try {
    window.sessionStorage.removeItem(prefix + key);
  } catch {
    // Ignore unavailable storage.
  }
}
/** Accept only an in-site relative path; a leading locale segment is dropped because the router adds the active one. */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 200 || !raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/[\\\s]/.test(raw) || /^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  try {
    const url = new URL(raw, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid') return null;
    const segments = url.pathname.split('/');
    const path = isLocale(segments[1] ?? '') ? `/${segments.slice(2).join('/')}` : url.pathname;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
/** Whether the current URL records the second form step. */
export function urlStep(): 1 | 2 {
  return new URL(window.location.href).searchParams.get('step') === '2' ? 2 : 1;
}
/** Push or drop the step marker; Next.js syncs native history calls into its router state. */
export function setUrlStep(step: 1 | 2, mode: 'push' | 'replace') {
  const url = new URL(window.location.href);
  if (step === 2) url.searchParams.set('step', '2');
  else url.searchParams.delete('step');
  if (url.href === window.location.href) return;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}
