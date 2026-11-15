import type { Href } from 'expo-router';
import type { Profile } from './data/models';
type Relation = NonNullable<Profile['relation']>;
const relations: readonly Relation[] = ['self', 'partner', 'family', 'friend', 'other'];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
/** Only in-app absolute paths are accepted, so a deep link cannot bounce the form to another scheme or host. */
export function safeReturnTo(value: string | string[] | undefined): string | null {
  const path = first(value);
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  if (/^\/[^?#]*:/.test(path) || path.length > 300) return null;
  return path;
}
/** A preset relation from the `relation` query parameter, when it is a known value. */
export function relationParam(value: string | string[] | undefined): Relation | null {
  const relation = first(value);
  return relations.includes(relation as Relation) ? (relation as Relation) : null;
}
/** Where a saved form goes next: `returnTo` (with `system` passed back as a query parameter), else the profile list. */
export function birthDoneHref(
  returnTo: string | null,
  system: string | string[] | undefined,
): Href {
  return birthDonePath(returnTo, system) as Href;
}
function birthDonePath(returnTo: string | null, system: string | string[] | undefined): string {
  if (!returnTo) return '/me?saved=1';
  const value = first(system);
  if (!value || !/^[a-z]{2,20}$/.test(value)) return returnTo;
  const [path, hash] = returnTo.split('#', 2);
  // Callers may already carry `system` (and other state) in returnTo's own query string.
  if (/[?&]system=/.test(path!)) return returnTo;
  const joined = `${path}${path!.includes('?') ? '&' : '?'}system=${value}`;
  return hash === undefined ? joined : `${joined}#${hash}`;
}
