import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import { IanaTimezoneSchema } from './birth';
import { DailyChartSchema } from './charts/daily';
// DESIGN-GAP: One entry per profile/civil date; a sentence is optional, capped at 500 characters and kept on one line.
export const JournalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    try {
      const date = Temporal.PlainDate.from(value, { overflow: 'reject' });
      return date.year >= 1900 && date.year <= 2100;
    } catch {
      return false;
    }
  });
export const JournalKeySchema = z
  .object({ profileId: z.string().min(1), date: JournalDateSchema })
  .strict();
export const JournalInputSchema = JournalKeySchema.extend({
  mood: z.number().int().min(1).max(5),
  text: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !/[\r\n]/.test(value)),
  tz: IanaTimezoneSchema,
}).strict();
// DESIGN-GAP: Immutable score/zone/version snapshots preserve the original comparison after profile or engine changes.
export const JournalPredictionSchema = z
  .object({
    scores: DailyChartSchema.shape.scores,
    tz: IanaTimezoneSchema,
    profileVersion: z.number().int().positive(),
    engineVersion: z.string().min(1),
  })
  .strict();
export type JournalPrediction = z.infer<typeof JournalPredictionSchema>;
export type JournalEntryView = {
  id: string;
  profileId: string;
  date: string;
  mood: number;
  text: string;
  prediction: JournalPrediction;
  createdAt: string;
};
