import { Temporal } from '@js-temporal/polyfill';
import { BirthInputSchema } from '@tianji/shared';
import { SettingsSchema, type LocalRecord, type Profile } from '../lib/data/models';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import {
  planEngagement,
  guideIndex,
  currentWidget,
  notificationRoute,
  specialEvents,
  stars,
} from '../lib/engagement/planner';
import { getCopy } from '../lib/copy';
import { resources } from '../lib/i18n';
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test' }));
jest.mock('../lib/knowledge', () => ({}));
jest.mock('../lib/data/store', () => ({}));
const settings = SettingsSchema.parse({ onboardingVersion: 1, tz: 'America/New_York' });
const profile: LocalRecord<Profile> = {
  id: 'a',
  userId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  data: { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
};
it('defaults on at 08:00, rotates 30 trilingual messages by date and preserves leap-day progression', () => {
  expect(settings.dailyPushEnabled).toBe(true);
  expect(settings.specialDayReminders).toBe(true);
  expect(settings.dailyPushTime).toBe('08:00');
  const indexes = Array.from({ length: 30 }, (_, index) =>
    guideIndex(Temporal.PlainDate.from('2026-01-01').add({ days: index }).toString()),
  );
  expect(new Set(indexes).size).toBe(30);
  expect((guideIndex('2028-02-29') + 1) % 30).toBe(guideIndex('2028-03-01'));
  for (const locale of ['zh', 'zh-TW', 'en'] as const)
    for (let i = 0; i < 30; i++) {
      const key =
        `mobile.push.guide.${String(i).padStart(2, '0')}` as keyof typeof resources.zh.translation;
      expect(getCopy(locale)(key)).not.toBe(key);
      expect(getCopy(locale)(key).length).toBeGreaterThan(10);
    }
});
it('schedules seven future civil-day deliveries across DST and changes route without sharing birth data', () => {
  const first = planEngagement(null, settings, '2026-03-07T14:00:00Z', undefined, []);
  const daily = first.reminders.filter((r) => r.id.includes(':daily:'));
  expect(daily).toHaveLength(7);
  expect(daily.every((r) => r.route === '/me/birth')).toBe(true);
  expect(
    daily.map(
      (r) =>
        Temporal.Instant.fromEpochMilliseconds(r.at).toZonedDateTimeISO('America/New_York').hour,
    ),
  ).toEqual(Array(7).fill(8));
  expect(first.snapshot.days[1]!.expiresAt - first.snapshot.days[1]!.startsAt).toBe(23 * 3600000);
  const personal = planEngagement(profile, settings, '2026-03-07T14:00:00Z', undefined, []);
  expect(personal.reminders.every((r) => r.route === '/today')).toBe(true);
  expect(personal.snapshot.days[0]!.dimensions).toHaveLength(5);
  expect(personal.snapshot.days[0]!.stars).toMatch(/^[★☆]{5}$/);
  expect(stars(95)).toBe('★★★★★');
  expect(stars(15)).toBe('★☆☆☆☆');
  const raw = JSON.stringify(personal.snapshot);
  for (const field of ['birth', 'profileId', 'userId', 'inputSnapshot', 'token', '1990-05-15'])
    expect(raw).not.toContain(field);
  expect(raw).not.toContain('daily.dimension');
  expect(currentWidget(personal.snapshot, personal.snapshot.days[0]!.startsAt)?.date).toBe(
    '2026-03-07',
  );
  expect(currentWidget(personal.snapshot, personal.snapshot.days.at(-1)!.expiresAt)).toBeNull();
}, 30000);
it('toggles daily and special reminders independently, and covers year rollover', () => {
  const event = {
    kind: 'solar_term' as const,
    at: '2027-01-01T12:00:00Z',
    date: '2027-01-01',
    detail: 'xiao_han',
  };
  const plan = planEngagement(
    null,
    { ...settings, dailyPushEnabled: false },
    '2026-12-30T12:00:00Z',
    'UTC',
    [event],
  );
  expect(plan.reminders).toHaveLength(1);
  expect(plan.reminders[0]!.id).toBe('tianji:special:2027-01-01');
  const off = planEngagement(
    null,
    { ...settings, dailyPushEnabled: false, specialDayReminders: false },
    '2026-12-30T12:00:00Z',
    'UTC',
    [event],
  );
  expect(off.reminders).toHaveLength(0);
}, 30000);
it('uses exact Mercury start/end, new/full moon and personal-period events', () => {
  const events = [
    {
      kind: 'retrograde' as const,
      at: '2026-10-04T12:00:00Z',
      date: '2026-10-04',
      end: '2026-10-25T12:00:00Z',
      endDate: '2026-10-25',
      detail: 'mercury',
    },
    { kind: 'bazi_luck' as const, at: '2026-10-04T12:00:00Z', date: '2026-10-04' },
    { kind: 'new_moon' as const, at: '2026-10-04T12:00:00Z', date: '2026-10-04' },
  ];
  expect(specialEvents(events, '2026-10-04', false)).toHaveLength(2);
  expect(specialEvents(events, '2026-10-04', true)).toHaveLength(3);
  expect(specialEvents(events, '2026-10-25', true)).toEqual(['mobile.push.retrogradeEnd']);
  expect(specialEvents(events, '2026-10-15', true)).toEqual([]);
  expect(notificationRoute('/today')).toBe('/today');
  expect(notificationRoute('/me/birth')).toBe('/me/birth');
  expect(notificationRoute('https://evil.test')).toBeNull();
  expect(notificationRoute('/me/settings')).toBeNull();
});
