import { z } from 'zod';
// DESIGN-GAP: T-10 placeholders accept only an empty chart; the system task will extend this shape.
export const TarotChartSchema = z.object({}).strict();
export type TarotChart = z.infer<typeof TarotChartSchema>;
