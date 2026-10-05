import { expect, it } from 'vitest';
import { BirthInputSchema, IanaTimezoneSchema, ReadingRequestSchema } from '../src';

it('rejects unbounded city names and invalid/non-IANA timezones at the input boundary', () => {
  const birth = {
    calendar: 'gregorian',
    year: 1990,
    month: 5,
    day: 15,
    timeUnknown: true,
    gender: 'unspecified',
    place: { name: 'Singapore', lat: 1.3, lng: 103.8, tz: 'Asia/Singapore' },
  };
  expect(BirthInputSchema.safeParse(birth).success).toBe(true);
  expect(
    BirthInputSchema.safeParse({ ...birth, place: { ...birth.place, name: 'x'.repeat(201) } })
      .success,
  ).toBe(false);
  for (const zone of ['Mars/Olympus', '+08:00', '', '../etc/passwd', 'https://example.test'])
    expect(IanaTimezoneSchema.safeParse(zone).success).toBe(false);
});

it('enforces the 120-character question limit on both flat and structured requests', () => {
  const request = { system: 'iching', locale: 'zh', idempotencyKey: crypto.randomUUID() };
  for (const question of [
    'x'.repeat(121),
    { text: 'x'.repeat(121) },
    { question: 'x'.repeat(121) },
    { text: { nested: 'invalid' } },
  ])
    expect(ReadingRequestSchema.safeParse({ ...request, question }).success).toBe(false);
  expect(
    ReadingRequestSchema.safeParse({
      ...request,
      question: { text: 'x'.repeat(120), at: '2026-10-05T12:00:00Z[UTC]' },
    }).success,
  ).toBe(true);
});
