import { describe, expect, it } from 'vitest';
import { computeTarot, dailyTarotSeed, drawDaily } from '@tianji/engine/tarot';
import { ritualDeck, TarotDraftSchema } from '../lib/tarot';
import { ReadingRequestSchema } from '@tianji/shared';
import zh from '../messages/zh/tarot.json';
import en from '../messages/en/tarot.json';
describe('tarot ritual boundary', () => {
  it('preserves unique selectable indices after shuffles and each cut order', () => {
    for (const order of [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ]) {
      const deck = ritualDeck(2, order);
      expect(new Set(deck).size).toBe(78);
      expect([...deck].sort((a, b) => a - b)).toEqual(Array.from({ length: 78 }, (_, i) => i));
    }
    expect(ritualDeck(1, [])).not.toEqual(ritualDeck(2, []));
    expect(ritualDeck(1, [2, 0, 1])).not.toEqual(ritualDeck(1, []));
  });
  it('validates private drafts and retains seeded choices/reversal controls through saved requests', () => {
    const draft = TarotDraftSchema.parse({
      seed: 'test-seed-001',
      spread: 'three_ppf',
      question: 'What next?',
      category: 'general',
      allowReversed: false,
    });
    const pickedIndices = ritualDeck(1, [2, 0, 1]).slice(0, 3);
    const request = ReadingRequestSchema.parse({
      ...draft,
      system: 'tarot',
      locale: 'zh',
      pickedIndices,
      idempotencyKey: 'd267074d-bb21-4c76-8053-4ac7547c8814',
    });
    const first = computeTarot({ ...draft, pickedIndices });
    expect(
      computeTarot({
        ...draft,
        pickedIndices: request.pickedIndices,
        allowReversed: request.allowReversed,
      }),
    ).toEqual(first);
    expect(first.cards.every((c) => !c.reversed)).toBe(true);
    expect(first.question).not.toContain('What next?');
    expect(TarotDraftSchema.safeParse({ ...draft, question: 'x'.repeat(121) }).success).toBe(false);
  });
  it('keeps daily cards fixed by identity and date and card catalogs bilingual', () => {
    expect(drawDaily(dailyTarotSeed('anon-36', '2026-10-05'))).toEqual(
      drawDaily(dailyTarotSeed('anon-36', '2026-10-05')),
    );
    expect(dailyTarotSeed('anon-36', '2026-10-06')).not.toEqual(
      dailyTarotSeed('anon-36', '2026-10-05'),
    );
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
});
