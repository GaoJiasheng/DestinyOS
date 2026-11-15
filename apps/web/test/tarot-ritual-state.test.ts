import { describe, expect, it } from 'vitest';
import {
  clipQuestion,
  parseTarotEntry,
  removePosition,
  showReplaySeed,
  togglePick,
} from '../components/tarot/ritual-state';
import { submitLabel } from '../components/forms/divination-fields';

describe('tarot ritual state', () => {
  it('accepts only documented spreads and clips the carried question', () => {
    expect(parseTarotEntry('single', '  今年适合换工作吗  ')).toEqual({
      spread: 'single',
      question: '今年适合换工作吗',
    });
    expect(parseTarotEntry('single', undefined)).toEqual({ spread: 'single', question: '' });
    expect(parseTarotEntry('nonsense', 'q')).toBeNull();
    expect(parseTarotEntry(['single'], 'q')).toBeNull();
    expect(parseTarotEntry('celtic_cross', 'x'.repeat(300))?.question).toHaveLength(120);
    expect(clipQuestion(['a', 'b'])).toBe('');
  });

  it('lets a pick be undone and keeps later picks in order', () => {
    expect(togglePick([], 5, 3)).toEqual([5]);
    expect(togglePick([5, 9], 5, 3)).toEqual([9]);
    expect(togglePick([5, 9, 2], 7, 3)).toEqual([5, 9, 2]);
    expect(togglePick([5, 9, 2], 2, 3)).toEqual([5, 9]);
    expect(removePosition([5, 9, 2], 1)).toEqual([5, 2]);
  });

  it('hides the replay seed in production unless debugging', () => {
    expect(showReplaySeed('', true)).toBe(false);
    expect(showReplaySeed('?debug=1', true)).toBe(true);
    expect(showReplaySeed('', false)).toBe(true);
  });
});

describe('divination submit label', () => {
  it('follows the step and method', () => {
    const base = { busy: false, system: 'iching', throwsDone: 0 } as const;
    expect(submitLabel({ ...base, step: 'question', method: 'random' })).toBe('continue');
    expect(submitLabel({ ...base, step: 'ritual', method: 'random' })).toBe('toss');
    expect(submitLabel({ ...base, step: 'ritual', method: 'liuyao', throwsDone: 6 })).toBe('retry');
    expect(submitLabel({ ...base, system: 'qimen', step: 'question', method: 'time' })).toBe(
      'castQimen',
    );
    expect(submitLabel({ ...base, busy: true, step: 'ritual', method: 'time' })).toBe('working');
  });
});
