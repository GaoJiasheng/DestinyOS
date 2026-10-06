import { Temporal } from '@js-temporal/polyfill';
import type { JournalPrediction } from '@tianji/shared';
export const JOURNAL_DOMAINS = ['career', 'wealth', 'love', 'health', 'social'] as const;
export type JournalDomain = (typeof JOURNAL_DOMAINS)[number];
export type JournalSample = { date: string; mood: number; prediction: JournalPrediction };
export type JournalStats = {
  count: number;
  correlation: number | null;
  streak: number;
  longestStreak: number;
  domains: { domain: JournalDomain; hits: number }[];
};
/** Map 0–100 forecast scores to the daily page's documented 1–5 star bands. */
export function journalStars(score: number): number {
  return score >= 85 ? 5 : score >= 70 ? 4 : score >= 55 ? 3 : score >= 40 ? 2 : 1;
}
/** Pearson r for paired total scores/moods; undefined for fewer than three pairs or zero variance. */
export function journalCorrelation(samples: readonly JournalSample[]): number | null {
  // DESIGN-GAP: Require three pairs, report signed Pearson r without claiming predictive accuracy or causation.
  if (samples.length < 3) return null;
  const meanX = samples.reduce((sum, s) => sum + s.prediction.scores.overall, 0) / samples.length;
  const meanY = samples.reduce((sum, s) => sum + s.mood, 0) / samples.length;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (const sample of samples) {
    const x = sample.prediction.scores.overall - meanX,
      y = sample.mood - meanY;
    xx += x * x;
    yy += y * y;
    xy += x * y;
  }
  return xx === 0 || yy === 0 ? null : Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy)));
}
/** Profile-specific Mirror summary; civil dates avoid DST effects and ties remain visible. */
export function journalStats(samples: readonly JournalSample[], today: string): JournalStats {
  const dates = [...new Set(samples.map((s) => s.date))].sort();
  let run = 0,
    longestStreak = 0,
    previous: string | undefined;
  for (const date of dates) {
    run =
      previous && Temporal.PlainDate.from(previous).add({ days: 1 }).toString() === date
        ? run + 1
        : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = date;
  }
  // DESIGN-GAP: A current streak can end yesterday, so users do not lose it before today's entry; gaps reset it.
  const recorded = new Set(dates);
  let cursor = Temporal.PlainDate.from(today),
    streak = 0;
  if (!recorded.has(cursor.toString())) cursor = cursor.subtract({ days: 1 });
  while (recorded.has(cursor.toString())) {
    streak++;
    cursor = cursor.subtract({ days: 1 });
  }
  // DESIGN-GAP: No domain ratings are requested; hits are exact matches between domain stars and the overall mood, not verified domain outcomes.
  const domains = JOURNAL_DOMAINS.map((domain) => ({
    domain,
    hits: samples.filter((s) => journalStars(s.prediction.scores[domain]) === s.mood).length,
  }));
  const max = Math.max(0, ...domains.map((d) => d.hits));
  return {
    count: samples.length,
    correlation: journalCorrelation(samples),
    streak,
    longestStreak,
    domains: max ? domains.filter((d) => d.hits === max) : [],
  };
}
