import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import {
  NormalizedBirthSchema,
  NumerologyChartSchema,
  NumerologyNameSchema,
  type NumerologyChart,
} from '@tianji/shared';
import { parseInput } from '../common/divination';
import { EngineError } from '../common/error';
export { NumerologyChartSchema } from '@tianji/shared';
export type { NumerologyChart } from '@tianji/shared';
const inputSchema = z
  .object({
    birth: NormalizedBirthSchema,
    name: NumerologyNameSchema.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type NumerologyInput = z.infer<typeof inputSchema>;
/** Sum decimal digits of a nonnegative integer, without date or timezone conversion. */
export function digitSum(value: number): number {
  return Array.from(String(value), Number).reduce((sum, digit) => sum + digit, 0);
}
/** Reduce a nonnegative integer; 0 denotes an empty vowel/consonant group, never a personal number. */
export function reduceNumber(
  sum: number,
  masters = true,
): NonNullable<NumerologyChart['nameNumbers']>['expression'] {
  if (!Number.isSafeInteger(sum) || sum < 0) throw new EngineError('E_INVALID_INPUT');
  const steps = [sum];
  let number = sum;
  while (number > 9 && !(masters && [11, 22, 33].includes(number))) {
    number = digitSum(number);
    steps.push(number);
  }
  return {
    sum,
    steps,
    number: number === 0 ? null : (number as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11 | 22 | 33),
  };
}
// DESIGN-GAP: Personal periods use January-first calendar years and reduce all master numbers to 1–9.
/** Personal calendar year/month/day numbers, using a Gregorian birth month/day and explicit target ISO date. */
export function personalNumbers(
  month: number,
  day: number,
  date: string,
): NumerologyChart['personal'] {
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    throw new EngineError('E_INVALID_INPUT');
  try {
    const target = Temporal.PlainDate.from(date, { overflow: 'reject' });
    if (target.year < 1900 || target.year > 2100) throw new EngineError('E_DATE_OUT_OF_RANGE');
    const year = reduceNumber(
      digitSum(month) + digitSum(day) + digitSum(target.year),
      false,
    ).number!;
    const personalMonth = reduceNumber(year + target.month, false).number!;
    return {
      year,
      month: personalMonth,
      day: reduceNumber(personalMonth + target.day, false).number!,
      targetDate: target.toString(),
    };
  } catch (error) {
    if (error instanceof EngineError) throw error;
    throw new EngineError('E_INVALID_INPUT');
  }
}
/** Deterministic Pythagorean numerology from normalized Gregorian birth date; no clock, IO or raw name in output. */
export function computeNumerology(raw: NumerologyInput): NumerologyChart {
  const { birth, name, date } = parseInput(inputSchema, raw);
  const { year, month, day } = birth.local;
  const digits = Array.from(
    `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
    Number,
  );
  const lifePath = reduceNumber(digits.reduce((sum, digit) => sum + digit, 0));
  // DESIGN-GAP: B-10 does not specify Y or punctuation; AEIOU are vowels, Y is a consonant, separators are ignored; only ASCII English letters are accepted.
  const letters = (name ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  const total = (vowels: boolean | null) =>
    Array.from(letters)
      .filter((letter) => vowels === null || /[AEIOU]/.test(letter) === vowels)
      .reduce((sum, letter) => sum + ((letter.charCodeAt(0) - 65) % 9) + 1, 0);
  const nameNumbers = letters
    ? {
        expression: reduceNumber(total(null)),
        soul: reduceNumber(total(true)),
        personality: reduceNumber(total(false)),
      }
    : null;
  const personal = personalNumbers(month, day, date);
  // DESIGN-GAP: Flow cycles show the current Gregorian year and the next eight years; cycles never retain master numbers.
  const targetYear = Temporal.PlainDate.from(date).year;
  const first = reduceNumber(lifePath.number!, false).number!;
  const second = reduceNumber(nameNumbers?.expression.number ?? day, false).number!;
  return NumerologyChartSchema.parse({
    lifePath,
    birthday: { day, number: reduceNumber(day).number },
    nameNumbers,
    personal,
    cycles: Array.from({ length: 9 }, (_, i) => ({
      year: targetYear + i,
      number: ((personal.year - 1 + i) % 9) + 1,
      isCurrent: i === 0,
    })),
    // DESIGN-GAP: The grid counts nonzero Gregorian birthday digits in Pythagorean columns 1/4/7, 2/5/8, 3/6/9; missing digits imply no deficit.
    grid: Array.from({ length: 9 }, (_, i) => ({
      digit: i + 1,
      count: digits.filter((digit) => digit === i + 1).length,
    })),
    // DESIGN-GAP: No second profile is requested; compatibility compares life path with expression (or birthday), reducing masters to their base number. It describes inner cooperation, not a partner score.
    compatibility: {
      first: Math.min(first, second),
      second: Math.max(first, second),
      basis: nameNumbers ? 'expression' : 'birthday',
    },
  });
}
