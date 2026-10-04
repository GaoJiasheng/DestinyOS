import { z } from 'zod';
// DESIGN-GAP: T-10 placeholders accept only an empty chart; the system task will extend this shape.
export const QimenChartSchema = z.object({}).strict();
export type QimenChart = z.infer<typeof QimenChartSchema>;
