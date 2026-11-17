/**
 * Whether the server is still streaming content for some Suspense boundary on this page. React
 * marks such a boundary with a `B:` template after a `$?` comment (`$~` once its content arrived
 * but has not been revealed yet).
 */
export function isStreaming(): boolean {
  if (typeof document === 'undefined') return false;
  for (const template of document.querySelectorAll('template[id^="B:"]')) {
    const marker = template.previousSibling;
    if (marker instanceof Comment && (marker.data === '$?' || marker.data === '$~')) return true;
  }
  return false;
}

/**
 * Apply a shell-wide change once the page has finished streaming. Any update that reaches a
 * pending Suspense boundary (a changed context value above it, or new props), even inside a
 * transition, makes React discard that boundary's server HTML and render it again in the browser,
 * leaving the late HTML behind as a hidden duplicate. Returns a cancel function for effect cleanup.
 */
export function afterStream(update: () => void): () => void {
  if (!isStreaming()) {
    update();
    return () => undefined;
  }
  const observer = new MutationObserver(() => {
    if (isStreaming()) return;
    observer.disconnect();
    update();
  });
  // A boundary settles by being revealed (template removed) or failing (comment data changes).
  observer.observe(document, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}
