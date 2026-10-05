import { expect, it } from 'vitest';
import { mutualReceptions, TRADITIONAL_RULERS } from '../src';

it('mutual receptions use modern and traditional domicile rulers, no false self-receptions', () => {
  expect(
    mutualReceptions([
      { key: 'mercury', sign: 'taurus' },
      { key: 'venus', sign: 'gemini' },
    ]),
  ).toEqual([['mercury', 'venus']]);
  const pair = [
    { key: 'mars' as const, sign: 'aquarius' as const },
    { key: 'saturn' as const, sign: 'scorpio' as const },
  ];
  expect(mutualReceptions(pair)).toEqual([]);
  expect(mutualReceptions(pair, TRADITIONAL_RULERS)).toEqual([['mars', 'saturn']]);
  expect(
    mutualReceptions([
      { key: 'mercury', sign: 'gemini' },
      { key: 'venus', sign: 'taurus' },
    ]),
  ).toEqual([]);
});
