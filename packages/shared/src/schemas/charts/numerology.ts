import { z } from 'zod';
export const NumerologyNumberSchema = z.union([
  z.number().int().min(1).max(9),
  z.literal(11),
  z.literal(22),
  z.literal(33),
]);
const single = z.number().int().min(1).max(9);
const reduction = z
  .object({
    sum: z.number().int().nonnegative(),
    steps: z.array(z.number().int().nonnegative()).min(1),
    number: NumerologyNumberSchema.nullable(),
  })
  .strict();
export const NumerologyNameSchema = z
  .string()
  .trim()
  .max(120)
  .refine((name) => name === '' || /^[A-Za-z]+(?:[ '\u2019-]+[A-Za-z]+)*$/.test(name));
export const NumerologyChartSchema = z
  .object({
    lifePath: reduction.extend({ number: NumerologyNumberSchema }),
    birthday: z
      .object({ day: z.number().int().min(1).max(31), number: NumerologyNumberSchema })
      .strict(),
    nameNumbers: z
      .object({ expression: reduction, soul: reduction, personality: reduction })
      .strict()
      .nullable(),
    personal: z
      .object({
        year: single,
        month: single,
        day: single,
        targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict(),
    cycles: z
      .array(z.object({ year: z.number().int(), number: single, isCurrent: z.boolean() }).strict())
      .length(9),
    grid: z
      .array(z.object({ digit: single, count: z.number().int().min(0).max(8) }).strict())
      .length(9),
    compatibility: z
      .object({ first: single, second: single, basis: z.enum(['birthday', 'expression']) })
      .strict(),
  })
  .strict();
export type NumerologyChart = z.infer<typeof NumerologyChartSchema>;
export type NumerologyNumber = z.infer<typeof NumerologyNumberSchema>;
