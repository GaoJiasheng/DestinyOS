import { z } from 'zod';

export const verificationSchema = z.object({
  token: z.string().regex(/^[a-zA-Z0-9_-]{16,256}$/),
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(['zh', 'en', 'zh-TW']),
});
export type Verification = z.infer<typeof verificationSchema>;
