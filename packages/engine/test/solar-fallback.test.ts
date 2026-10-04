import { expect, it, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
vi.mock('@openfate/true-solar-time', () => ({ calculateTrueSolarTime: vi.fn() }));
import { calculateTrueSolarTime } from '@openfate/true-solar-time';
import { apparentSolarTime, noaaSolarOffset } from '../src/common/solar-time';
it('falls back to NOAA on library exceptions or non-finite results', () => {
  const time = Temporal.ZonedDateTime.from('2024-07-01T12:00[America/New_York]');
  vi.mocked(calculateTrueSolarTime).mockImplementationOnce(() => {
    throw new Error('library failure');
  });
  expect(apparentSolarTime(time, -74.01).offsetMinutes).toBe(noaaSolarOffset(time, -74.01));
  vi.mocked(calculateTrueSolarTime).mockReturnValueOnce({
    equationOfTimeMinutes: NaN,
  } as ReturnType<typeof calculateTrueSolarTime>);
  expect(apparentSolarTime(time, -74.01).offsetMinutes).toBe(noaaSolarOffset(time, -74.01));
});
