import { z } from 'zod';
// DESIGN-GAP: T-10 placeholders accept only an empty chart; the system task will extend this shape.
export const IchingChartSchema = z.object({}).strict();
export type IchingChart = z.infer<typeof IchingChartSchema>;
