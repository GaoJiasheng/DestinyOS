import type { BirthProfile } from '@prisma/client';
import type { BirthInput, Locale } from '@tianji/shared';
import { isUnderThirteen } from './birth-form';
import { ApiError } from './api-error';
import type { ReadingRequest } from './reading-schema';
// The age rule protects the person using the service: an under-13 birth is refused and locks the
// session when it is the user's own. Someone else's birth is allowed only when explicitly marked.
export type AgeSubject = 'self' | 'other';
/** Reject an under-13 birth that belongs to the user before computing or storing anything.
 * Only an explicit 'other' (someone else's birthday) is exempt; a missing mark means the user. */
export function checkAge(birth: BirthInput, locale: Locale, subject: AgeSubject = 'self') {
  if (subject === 'other') return;
  if (isUnderThirteen(birth, locale)) throw new ApiError('E_AGE_RESTRICTED', 'Age restricted', 403);
}
/** Age rule for a whole request: `birth` follows `subject`; a synastry partner is always someone else. */
export function checkRequestAge(req: ReadingRequest) {
  if (req.birth) checkAge(req.birth, req.locale, req.subject);
}
/** A saved profile speaks for itself: only relation 'self' is the user. */
export const profileSubject = (relation: string): AgeSubject =>
  relation === 'self' ? 'self' : 'other';
/** Whose birth a signed-in request carries. Profile-sourced births follow the profile's relation.
 * A typed birth keeps an explicit mark; without one, only a profile the client named by ID
 * (App sync) may vouch for it, never the browser's implicit selection. Otherwise it is the user. */
export function birthSubject(req: ReadingRequest, profile: BirthProfile | null | undefined) {
  if (!req.birth) return profile ? profileSubject(profile.relation) : req.subject;
  if (req.subject) return req.subject;
  return req.profileId && profile ? profileSubject(profile.relation) : undefined;
}
