import { z } from 'zod';
import { ZIWEI_STAR_KEYS } from '../../constants/ziwei';
import { Branch, Stem, Mutagen, Palace } from '../../enums';
export const BrightnessSchema = z.enum(['miao', 'wang', 'de', 'li', 'ping', 'bu', 'xian']);
export type Brightness = z.infer<typeof BrightnessSchema>;
export const StarKeySchema = z.enum(ZIWEI_STAR_KEYS);
export type StarKey = z.infer<typeof StarKeySchema>;
export const PatternHitSchema = z
  .object({
    key: z.string(),
    palaces: z.array(z.nativeEnum(Palace)),
    stars: z.array(StarKeySchema),
    strength: z.number().min(0).max(1),
  })
  .strict();
export type PatternHit = z.infer<typeof PatternHitSchema>;
const star = z
  .object({
    key: StarKeySchema,
    brightness: BrightnessSchema.optional(),
    mutagen: z.nativeEnum(Mutagen).optional(),
  })
  .strict();
const mutagens = z
  .object({ lu: StarKeySchema, quan: StarKeySchema, ke: StarKeySchema, ji: StarKeySchema })
  .strict();
const index = z.number().int().min(0).max(11);
const age = z.number().int().min(1);
export const ZiweiChartSchema = z
  .object({
    basics: z
      .object({
        lunar: z
          .object({
            year: z.number().int(),
            month: z.number().int().min(1).max(12),
            isLeap: z.boolean(),
            day: z.number().int().min(1).max(30),
            hourBranch: z.nativeEnum(Branch),
          })
          .strict(),
        yearStem: z.nativeEnum(Stem),
        yearBranch: z.nativeEnum(Branch),
        fiveElementsClass: z
          .object({
            name: z.enum(['water_2', 'wood_3', 'metal_4', 'earth_5', 'fire_6']),
            number: z.number().int().min(2).max(6),
          })
          .strict(),
        soulMaster: StarKeySchema,
        bodyMaster: StarKeySchema,
        soulPalaceBranch: z.nativeEnum(Branch),
        bodyPalaceBranch: z.nativeEnum(Branch),
        zodiac: z.nativeEnum(Branch),
      })
      .strict(),
    palaces: z
      .array(
        z
          .object({
            index,
            key: z.nativeEnum(Palace),
            branch: z.nativeEnum(Branch),
            stem: z.nativeEnum(Stem),
            isBodyPalace: z.boolean(),
            majorStars: z.array(star.extend({ brightness: BrightnessSchema })),
            minorStars: z.array(star),
            adjectiveStars: z.array(StarKeySchema),
            changsheng12: StarKeySchema,
            boshi12: StarKeySchema,
            jiangqian12: StarKeySchema,
            suiqian12: StarKeySchema,
            decadal: z
              .object({
                fromAge: age,
                toAge: age,
                fromYear: z.number().int(),
                toYear: z.number().int(),
              })
              .strict(),
            ages: z.array(age),
          })
          .strict(),
      )
      .length(12),
    horoscope: z
      .object({
        decadal: z
          .object({
            palaceIndex: index,
            stem: z.nativeEnum(Stem),
            mutagens,
            fromAge: age,
            toAge: age,
          })
          .strict(),
        yearly: z
          .object({
            year: z.number().int(),
            palaceIndex: index,
            stem: z.nativeEnum(Stem),
            branch: z.nativeEnum(Branch),
            mutagens,
          })
          .strict(),
      })
      .strict(),
    patterns: z.array(PatternHitSchema),
    emptyPalaces: z.array(z.nativeEnum(Palace)),
  })
  .strict();
export type ZiweiChart = z.infer<typeof ZiweiChartSchema>;
