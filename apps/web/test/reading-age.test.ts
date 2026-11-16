import { describe, expect, it } from 'vitest';
import type { BirthProfile } from '@prisma/client';
import { birthSubject, checkAge, checkRequestAge, profileSubject } from '../lib/reading-age';
import type { ReadingRequest } from '../lib/reading-schema';
const child = {
  calendar: 'gregorian',
  year: 2020,
  month: 1,
  day: 1,
  timeUnknown: true,
  gender: 'unspecified',
} as const;
const adult = { ...child, year: 1990 } as const;
const req = (extra: Partial<ReadingRequest>): ReadingRequest => ({
  system: 'bazi',
  locale: 'zh',
  idempotencyKey: '00000000-0000-4000-8000-000000000001',
  ...extra,
});
const profile = (relation: string) => ({ id: 'p1', relation }) as unknown as BirthProfile;
describe('age rule', () => {
  it('refuses an under-13 birth unless it is explicitly someone else', () => {
    expect(() => checkAge(child, 'zh')).toThrow(
      expect.objectContaining({ code: 'E_AGE_RESTRICTED' }),
    );
    expect(() => checkAge(child, 'zh', 'self')).toThrow();
    expect(() => checkAge(child, 'zh', 'other')).not.toThrow();
    expect(() => checkAge(adult, 'zh')).not.toThrow();
  });
  it('checks the request birth by its subject and never the synastry partner', () => {
    expect(() => checkRequestAge(req({ birth: child }))).toThrow();
    expect(() => checkRequestAge(req({ birth: child, subject: 'self' }))).toThrow();
    expect(() => checkRequestAge(req({ birth: child, subject: 'other' }))).not.toThrow();
    expect(() =>
      checkRequestAge(req({ system: 'synastry', birth: adult, partnerBirth: child })),
    ).not.toThrow();
    expect(() =>
      checkRequestAge(req({ system: 'synastry', birth: child, partnerBirth: adult })),
    ).toThrow();
  });
  it('lets only relation self stand for the user', () => {
    expect(profileSubject('self')).toBe('self');
    for (const r of ['partner', 'family', 'friend', 'other'])
      expect(profileSubject(r)).toBe('other');
  });
  it('derives the subject from a profile only when the birth came from it or the client named it', () => {
    // Birth read from the profile: the relation decides, whatever the client claimed.
    expect(birthSubject(req({}), profile('family'))).toBe('other');
    expect(birthSubject(req({ subject: 'other' }), profile('self'))).toBe('self');
    // Typed birth with an explicit mark keeps it.
    expect(birthSubject(req({ birth: child, subject: 'other' }), profile('self'))).toBe('other');
    expect(birthSubject(req({ birth: child, subject: 'self' }), profile('family'))).toBe('self');
    // Typed birth without a mark: an explicitly named non-self profile (App sync) vouches for it,
    // the browser's implicit selection does not.
    expect(birthSubject(req({ birth: child, profileId: 'p1' }), profile('family'))).toBe('other');
    expect(birthSubject(req({ birth: child }), profile('family'))).toBeUndefined();
    expect(birthSubject(req({ birth: child, profileId: 'p1' }), profile('self'))).toBe('self');
  });
});
