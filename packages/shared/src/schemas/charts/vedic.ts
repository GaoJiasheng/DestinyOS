import { z } from 'zod';
// DESIGN-GAP: T-10 placeholders accept only an empty chart; the system task will extend this shape.
export const VedicChartSchema = z.object({}).strict();
export type VedicChart = z.infer<typeof VedicChartSchema>;
