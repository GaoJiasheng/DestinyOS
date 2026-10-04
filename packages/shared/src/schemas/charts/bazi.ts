import { z } from 'zod';
// DESIGN-GAP: T-10 placeholders accept only an empty chart; the system task will extend this shape.
export const BaziChartSchema = z.object({}).strict();
export type BaziChart = z.infer<typeof BaziChartSchema>;
