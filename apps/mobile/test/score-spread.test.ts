import { hasScoreSpread } from '../lib/reports/score-spread';

const flat = { career: 3, wealth: 3, love: 3, health: 3, social: 3 } as const;

test('scores are shown only when the five dimensions differ', () => {
  expect(hasScoreSpread(flat)).toBe(false);
  expect(hasScoreSpread({ ...flat, social: 4 })).toBe(true);
});

test('missing or empty scores are never shown', () => {
  expect(hasScoreSpread(undefined)).toBe(false);
  expect(hasScoreSpread(null)).toBe(false);
  expect(hasScoreSpread({})).toBe(false);
  expect(hasScoreSpread({ career: 3, wealth: 4, love: 3, health: 3 })).toBe(false);
});
