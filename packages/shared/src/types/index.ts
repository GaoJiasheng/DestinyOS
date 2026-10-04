import type { z } from 'zod';
import type {
  BirthInputSchema,
  NormalizedBirthSchema,
  EngineWarningSchema,
} from '../schemas/birth';
import type { EngineResultSchema } from '../schemas/engine-result';
export type BirthInput = z.infer<typeof BirthInputSchema>;
export type NormalizedBirth = z.infer<typeof NormalizedBirthSchema>;
export type EngineWarning = z.infer<typeof EngineWarningSchema>;
export type EngineResult<C = Record<string, unknown>> = Omit<
  z.infer<typeof EngineResultSchema>,
  'chart'
> & { chart: C };
