import { z } from 'zod';
import { Graha, Nakshatra, Sign } from '../../enums';
const degree = z.number().finite().min(0).lt(360);
const pada = z.number().int().min(1).max(4);
const nakshatra = z.enum(Nakshatra);
const limb = z
  .object({ index: z.number().int(), key: z.string(), endsAt: z.string().datetime() })
  .strict();
// DESIGN-GAP: Panchang carries sunrise/sunset and transitions until the next sunrise (including repeated limbs).
export const PanchangSchema = z
  .object({
    date: z.string(),
    tz: z.string(),
    sunrise: z.string().datetime().nullable(),
    sunset: z.string().datetime().nullable(),
    tithi: limb,
    nakshatra: limb,
    yoga: limb,
    karana: limb,
    vara: limb,
    transitions: z.array(
      z
        .object({
          limb: z.enum(['tithi', 'nakshatra', 'yoga', 'karana']),
          index: z.number().int(),
          key: z.string(),
          startsAt: z.string().datetime(),
          endsAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict();
const period = z
  .object({
    lord: z.nativeEnum(Graha),
    from: z.string().datetime(),
    to: z.string().datetime(),
    current: z.boolean(),
  })
  .strict();
export const VedicChartSchema = z
  .object({
    noonChart: z.boolean(),
    ayanamsa: degree,
    jdUT: z.number().finite(),
    lagna: z
      .object({
        sidLon: degree,
        sign: z.nativeEnum(Sign),
        nakshatra,
        pada,
        navamsaSign: z.nativeEnum(Sign),
      })
      .strict()
      .nullable(),
    bodies: z.array(
      z
        .object({
          key: z.nativeEnum(Graha),
          sidLon: degree,
          sign: z.nativeEnum(Sign),
          degInSign: degree.lt(30),
          house: z.number().int().min(1).max(12).nullable(),
          nakshatra,
          pada,
          retro: z.boolean(),
          combust: z.boolean(),
          dignity: z.enum([
            'exalted',
            'own',
            'moolatrikona',
            'debilitated',
            'friend',
            'neutral',
            'enemy',
          ]),
          navamsaSign: z.nativeEnum(Sign),
        })
        .strict(),
    ),
    houses: z
      .array(
        z
          .object({
            index: z.number().int().min(1).max(12),
            sign: z.nativeEnum(Sign),
            lord: z.nativeEnum(Graha),
            occupants: z.array(z.nativeEnum(Graha)),
          })
          .strict(),
      )
      .length(12)
      .nullable(),
    moon: z
      .object({
        nakshatra,
        pada,
        lord: z.nativeEnum(Graha),
        rashi: z.nativeEnum(Sign),
        possibleNakshatras: z.array(nakshatra).optional(),
      })
      .strict(),
    dasha: z.object({ sequence: z.array(period.extend({ antar: z.array(period) })) }).strict(),
    yogas: z.array(
      z
        .object({
          key: z.string(),
          bodies: z.array(z.nativeEnum(Graha)),
          houses: z.array(z.number().int().min(1).max(12)),
        })
        .strict(),
    ),
    panchangAtBirth: PanchangSchema.optional(),
    // DESIGN-GAP: Noon-chart uncertainty and D9 Lagna are explicit data rather than translated strings.
  })
  .strict();
export type VedicChart = z.infer<typeof VedicChartSchema>;
export type Panchang = z.infer<typeof PanchangSchema>;
