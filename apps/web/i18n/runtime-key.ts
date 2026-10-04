const parentMessages = new Set([
  'form.birth.timeUnknown',
  'nav.theme',
  'legal.disclaimer',
  'form.birth.city',
  'form.birth.gender',
  'form.birth.gender.unspecified',
  'form.birth.loader',
  'report.confidence',
  'report.feedback',
  'report.history',
  'tarot.category',
  'pwa.install',
]);
/** Resolve the documented parent-message/namespace collisions without bundling a catalog. */
export function runtimeKey(key: string, catalog?: Record<string, string>): string {
  return (
    catalog
      ? Object.keys(catalog).some((entry) => entry.startsWith(`${key}.`))
      : parentMessages.has(key)
  )
    ? `${key}.__value`
    : key;
}
