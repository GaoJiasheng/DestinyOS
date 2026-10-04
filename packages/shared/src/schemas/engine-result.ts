import { z } from 'zod';
import { System } from '../enums';
import { NormalizedBirthSchema, EngineWarningSchema } from './birth';
export const EngineMetaSchema = z
  .object({
    schoolUsed: z.record(z.union([z.string(), z.number().finite(), z.boolean()])),
    warnings: z.array(EngineWarningSchema),
    debug: z.record(z.unknown()).optional(),
  })
  .strict();
/** Creates the result envelope for a system-specific chart schema. */
export function createEngineResultSchema<C extends z.ZodType<unknown>>(chart: C) {
  return z
    .object({
      system: z.nativeEnum(System),
      engineVersion: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/),
      computedAt: z.string().datetime(),
      input: NormalizedBirthSchema.nullable(),
      chart,
      meta: EngineMetaSchema,
    })
    .strict();
}
export const EngineResultSchema = createEngineResultSchema(z.record(z.unknown()));
