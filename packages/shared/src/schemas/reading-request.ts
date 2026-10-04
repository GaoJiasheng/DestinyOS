import { z } from 'zod';
import { BirthInputSchema } from './birth';
import { System } from '../enums';
// DESIGN-GAP: Locale and the private display name accompany BirthInput without changing its documented fields.
export const ReadingRequestSchema = z
  .object({
    system: z.nativeEnum(System).refine((s) => s !== 'daily'),
    birth: BirthInputSchema.optional(),
    locale: z.enum(['zh', 'en']).default('zh'),
    displayName: z.string().trim().max(80).optional(),
    options: z
      .object({
        school: z.record(z.union([z.string(), z.number().finite(), z.boolean()])).optional(),
      })
      .strict()
      .optional(),
    question: z.union([z.string().trim().max(120), z.record(z.unknown())]).optional(),
    category: z.string().max(40).optional(),
    spread: z.string().max(40).optional(),
    method: z.string().max(40).optional(),
    numbers: z.array(z.number().int()).max(3).optional(),
    throws: z.array(z.number().int()).max(6).optional(),
    seed: z.string().max(200).optional(),
    // DESIGN-GAP: Expose documented tarot engine controls on the reading boundary so saved/imported rituals preserve choices and orientation.
    allowReversed: z.boolean().optional(),
    pickedIndices: z.array(z.number().int().min(0).max(77)).max(13).optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
