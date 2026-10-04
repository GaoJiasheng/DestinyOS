import { describe, it, expect } from 'vitest';
import { evaluateWhen, parsePath, resolvePath, specificity } from '../src';
import type { When } from '../src';
const chart = {
  a: { value: 2, nil: null },
  list: [
    { isCurrent: false, god: 'friend' },
    { isCurrent: true, god: 'wealth' },
  ],
  tags: ['wood', 'water'],
  text: 'hello world',
  features: { active: true },
  empty: [],
};
describe('JSONPath-lite and conditions', () => {
  it.each<[When, boolean]>([
    [{ path: 'a.value', eq: 2 }, true],
    [{ path: 'a.value', eq: '2' }, false],
    [{ path: 'list[*].god', eq: 'wealth' }, true],
    [{ path: 'list[*].god', eq: 'officer' }, false],
    [{ path: 'list[isCurrent=true].god', eq: 'wealth' }, true],
    [{ path: 'list[isCurrent=false].god', eq: 'wealth' }, false],
    [{ path: 'list[god="wealth"].isCurrent', eq: true }, true],
    [{ path: "list[god='wealth'].god", eq: 'wealth' }, true],
    [{ path: 'list.length', gte: 2 }, true],
    [{ path: 'list.length', lte: 1 }, false],
    [{ path: 'a.value', gte: 2 }, true],
    [{ path: 'a.value', lte: 2 }, true],
    [{ path: 'text', gte: 0 }, false],
    [{ path: 'a.value', in: [1, 2] }, true],
    [{ path: 'a.value', in: [3] }, false],
    [{ path: 'tags', contains: 'water' }, true],
    [{ path: 'tags', contains: 'fire' }, false],
    [{ path: 'text', contains: 'world' }, true],
    [{ path: 'text', contains: 2 }, false],
    [{ path: 'a.value', exists: true }, true],
    [{ path: 'a.missing', exists: false }, true],
    [{ path: 'a.nil', exists: true }, false],
    [{ path: 'a.nil', exists: false }, true],
    [{ path: 'empty', exists: true }, true],
    [{ path: 'empty[*]', exists: true }, false],
    [
      {
        all: [
          { path: 'a.value', gte: 1 },
          {
            any: [
              { path: 'tags', contains: 'fire' },
              { not: { path: 'features.active', eq: false } },
            ],
          },
        ],
      },
      true,
    ],
    [
      {
        all: [
          { path: 'a.value', eq: 2 },
          { path: 'missing', exists: true },
        ],
      },
      false,
    ],
    [
      {
        any: [
          { path: 'a.value', eq: 3 },
          { path: 'missing', exists: true },
        ],
      },
      false,
    ],
  ])('evaluates %j → %s', (when, expected) =>
    expect(evaluateWhen(chart, when).matched).toBe(expected),
  );
  it.each([
    '',
    '.a',
    'a.',
    'a..value',
    'list[]',
    'list[isCurrent]',
    'list[0]',
    'list[isCurrent==true].god',
    'a/value',
  ])('rejects invalid syntax %s', (path) => {
    if (path.includes('==')) expect(() => parsePath(path)).toThrow();
    else expect(() => parsePath(path)).toThrow();
  });
  it('validates filtered shapes without requiring a matching fixture value', () => {
    expect(resolvePath(chart, 'list[god=absent].god')).toEqual([]);
    expect(resolvePath(chart, 'list[god=absent].god', true)).toEqual(['friend', 'wealth']);
    expect(resolvePath(chart, 'list[typo=true].god', true)).toEqual([]);
    expect(resolvePath(chart, 'a.*')).toEqual([2, null]);
  });
  it('narrows consecutive aspect selectors on one entry, including reversed endpoints', () => {
    const sample = {
      aspects: [
        { a: 'sun', b: 'moon', type: 'square', major: true },
        { a: 'moon', b: 'saturn', type: 'trine', major: true },
      ],
    };
    expect(resolvePath(sample, 'aspects[a=sun][b=moon][type=square].major')).toEqual([true]);
    expect(resolvePath(sample, 'aspects[a=sun][b=moon][type=trine].major')).toEqual([]);
    expect(resolvePath(sample, 'aspects[a=sun][typo=moon].major', true)).toEqual([]);
    const rule: When = {
      any: [
        { path: 'aspects[a=sun][b=moon][type=square].major', eq: true },
        { path: 'aspects[a=moon][b=sun][type=square].major', eq: true },
      ],
    };
    expect(evaluateWhen(sample, rule).matched).toBe(true);
    expect(
      evaluateWhen({ aspects: sample.aspects.map((a) => ({ ...a, a: a.b, b: a.a })) }, rule)
        .matched,
    ).toBe(true);
  });
  it('only traces matched alternatives and counts all specificity', () => {
    expect(
      evaluateWhen(chart, {
        any: [
          { path: 'a.value', eq: 2 },
          { path: 'text', eq: 'wrong' },
        ],
      }).evidence,
    ).toEqual([{ path: 'a.value', value: 2 }]);
    expect(
      evaluateWhen(chart, {
        all: [
          { path: 'a.value', eq: 2 },
          { path: 'text', eq: 'wrong' },
        ],
      }).evidence,
    ).toEqual([]);
    expect(
      specificity({
        all: [
          { path: 'a.value', eq: 2 },
          { path: 'text', exists: true },
        ],
      }),
    ).toBe(6);
  });
});
