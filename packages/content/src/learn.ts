import { z } from 'zod';
const bilingual = z.object({ zh: z.string().min(1), en: z.string().min(1) });
const systemText = z
  .object({
    title: z.string().min(1),
    history: z.string().min(1),
    principle: z.string().min(1),
    questions: z.string().min(1),
    school: z.string().min(1),
    faq: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(1),
  })
  .strict();
export const LearnSystemsSchema = z
  .array(
    z
      .object({
        key: z.enum([
          'bazi',
          'ziwei',
          'iching',
          'qimen',
          'tarot',
          'astrology',
          'vedic',
          'numerology',
        ]),
        zh: systemText,
        en: systemText,
      })
      .strict(),
  )
  .length(8)
  .refine((v) => new Set(v.map((s) => s.key)).size === 8);
export const LearnCardsSchema = z
  .array(
    z.object({
      key: z.string(),
      number: z.number(),
      arcana: z.enum(['major', 'minor']),
      suit: z.string().nullable(),
      element: z.string(),
      name: bilingual,
      keywordsUpright: z.object({ zh: z.array(z.string()), en: z.array(z.string()) }),
      keywordsReversed: z.object({ zh: z.array(z.string()), en: z.array(z.string()) }),
      meaningUpright: bilingual,
      meaningReversed: bilingual,
      imagery: bilingual,
      advice: bilingual,
    }),
  )
  .length(78);
export const LearnHexagramsSchema = z
  .array(
    z.object({
      number: z.number().int().min(1).max(64),
      key: z.string(),
      name: z.string(),
      englishName: z.string(),
      pinyin: z.string(),
      lines: z.array(z.union([z.literal(0), z.literal(1)])).length(6),
      upper: z.string(),
      lower: z.string(),
      judgment: z.string(),
      tuan: z.string(),
      image: z.string(),
      meaning: bilingual,
      yao: z
        .array(
          z.object({
            position: z.number().int(),
            original: z.string(),
            image: z.string(),
            meaning: bilingual,
          }),
        )
        .length(6),
      guidance: z.record(bilingual),
    }),
  )
  .length(64);
export type LearnSystem = z.infer<typeof LearnSystemsSchema>[number];
export type LearnCard = z.infer<typeof LearnCardsSchema>[number];
export type LearnHexagram = z.infer<typeof LearnHexagramsSchema>[number];
