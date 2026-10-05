import { describe, expect, it } from 'vitest';
import { JournalInputSchema, type JournalPrediction } from '@tianji/shared';
import { journalCorrelation, journalStars, journalStats } from '../lib/journal-stats';
import { sanitize } from '../lib/privacy';
const prediction = (overall: number): JournalPrediction => ({
  scores: { overall, career: 90, wealth: 75, love: 60, health: 45, social: 30 },
  tz: 'America/New_York',
  profileVersion: 1,
  engineVersion: 'test',
});
const samples = [
  { date: '2026-03-07', mood: 1, prediction: prediction(30) },
  { date: '2026-03-08', mood: 3, prediction: prediction(60) },
  { date: '2026-03-09', mood: 5, prediction: prediction(90) },
];
describe('journal reflection statistics', () => {
  it('computes positive, negative and zero correlations, handling insufficient and constant samples', () => {
    expect(journalCorrelation(samples)).toBeCloseTo(1);
    expect(journalCorrelation(samples.map((s) => ({ ...s, mood: 6 - s.mood })))).toBeCloseTo(-1);
    expect(
      journalCorrelation(samples.map((s, i) => ({ ...s, mood: i === 1 ? 1 : 5 }))),
    ).toBeCloseTo(0);
    expect(journalCorrelation([])).toBeNull();
    expect(journalCorrelation(samples.slice(0, 2))).toBeNull();
    expect(journalCorrelation(samples.map((s) => ({ ...s, mood: 3 })))).toBeNull();
    expect(
      journalCorrelation(samples.map((s) => ({ ...s, prediction: prediction(60) }))),
    ).toBeNull();
  });
  it('tracks today/yesterday streaks across DST, resets gaps, and retains domain ties without false hits', () => {
    expect(journalStats(samples, '2026-03-09')).toMatchObject({
      streak: 3,
      longestStreak: 3,
      count: 3,
    });
    expect(journalStats(samples, '2026-03-10').streak).toBe(3);
    expect(journalStats(samples, '2026-03-11').streak).toBe(0);
    expect(journalStats([samples[0]!, samples[2]!], '2026-03-09')).toMatchObject({
      streak: 1,
      longestStreak: 1,
    });
    expect(journalStats(samples, '2026-03-09').domains).toEqual([
      { domain: 'career', hits: 1 },
      { domain: 'love', hits: 1 },
      { domain: 'social', hits: 1 },
    ]);
    expect(journalStats([], '2026-03-09').domains).toEqual([]);
    expect([39, 40, 55, 70, 85].map(journalStars)).toEqual([1, 2, 3, 4, 5]);
  });
  it('validates real civil dates, mood bounds, line limits and forbids forged owner/prediction inputs', () => {
    const input = {
      profileId: 'owned',
      date: '2026-03-09',
      tz: 'America/New_York',
      mood: 3,
      text: ' One sentence ',
    };
    expect(JournalInputSchema.parse(input).text).toBe('One sentence');
    expect(JournalInputSchema.parse({ ...input, text: '' }).text).toBe('');
    for (const bad of [
      { mood: 0 },
      { mood: 6 },
      { mood: 1.5 },
      { date: '2026-02-30' },
      { tz: 'Invalid/Zone' },
      { text: 'x'.repeat(501) },
      { text: 'two\nlines' },
      { userId: 'victim' },
      { prediction: {} },
    ])
      expect(JournalInputSchema.safeParse({ ...input, ...bad }).success).toBe(false);
    expect(
      sanitize({ journalEntries: [{ text: 'private note', mood: 2 }], text: 'private' }),
    ).toEqual({ journalEntries: '[REDACTED]', text: '[REDACTED]' });
  });
});
