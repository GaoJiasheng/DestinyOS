import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { z } from 'zod';

const root = fileURLToPath(new URL('../', import.meta.url));
export const storeRoot = path.join(root, 'apps/mobile/store/app-store');
export const evidenceRoot = path.join(root, 'apps/mobile/test-results/IOS-STORE');
export const locales = ['en-US', 'zh-Hans', 'zh-Hant'] as const;
export const sizes = { '6.9': [1320, 2868], '6.5': [1284, 2778] } as const;
// DESIGN-GAP: A fictitious adult profile uses the neutral nickname Alex through real forms; this avoids an existing empty-name fallback without changing shipped UI.
export const scenes = ['today', 'bazi', 'astrology', 'tarot', 'calendar', 'systems'] as const;
export const limits = {
  name: 30,
  subtitle: 30,
  promotionalText: 170,
  description: 4000,
  keywords: 100,
  whatsNew: 4000,
  supportUrl: 255,
  marketingUrl: 255,
  privacyPolicyUrl: 255,
} as const;
export const metadataSchema = z.object({
  locale: z.enum(locales),
  primaryLanguage: z.literal('en-US'),
  version: z.literal('1.0.0'),
  fields: z.object(
    Object.fromEntries(
      Object.keys(limits).map((key) => [
        key,
        z.object({
          value: z.string().min(1),
          characters: z.number().int(),
          limit: z.number().int(),
        }),
      ]),
    ),
  ),
  nameCandidates: z.array(
    z.object({ value: z.string(), characters: z.number().int(), preferred: z.boolean() }),
  ),
});
/** Count Unicode code points, including spaces, commas, punctuation and newlines. */
export function characters(text: string): number {
  return [...text.normalize('NFC')].length;
}
