import { z } from 'zod';
// DESIGN-GAP: T-10 placeholders accept only an empty chart; the system task will extend this shape.
export const AstrologyChartSchema = z.object({}).strict();
export type AstrologyChart = z.infer<typeof AstrologyChartSchema>;
