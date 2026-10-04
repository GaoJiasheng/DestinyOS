import { z } from 'zod';
import { Branch, Calendar, Gender, Stem, EngineWarningCode } from '../enums';

const year = z.number().int().min(1900).max(2100);
const month = z.number().int().min(1).max(12);
const day = z.number().int().min(1).max(31);
const hour = z.number().int().min(0).max(23);
const minute = z.number().int().min(0).max(59);
export const GanZhiSchema = z
  .object({ stem: z.nativeEnum(Stem), branch: z.nativeEnum(Branch) })
  .strict();
export const EngineWarningSchema = z
  .object({
    code: z.nativeEnum(EngineWarningCode),
    messageKey: z.string().min(1),
    params: z.record(z.unknown()).optional(),
  })
  .strict();
const birthInputObject = z
  .object({
    calendar: z.nativeEnum(Calendar),
    year,
    month,
    day,
    isLeapMonth: z.boolean().optional(),
    hour: hour.optional(),
    minute: minute.optional(),
    timeUnknown: z.boolean(),
    place: z
      .object({
        name: z.string().min(1),
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
        tz: z.string().min(1),
      })
      .strict()
      .optional(),
    gender: z.nativeEnum(Gender),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.calendar === 'gregorian' && !validGregorianDate(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['day'],
        message: 'engine.errors.E_INVALID_INPUT',
      });
    }
    if (value.calendar === 'gregorian' && value.isLeapMonth) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['isLeapMonth'],
        message: 'engine.errors.E_INVALID_INPUT',
      });
    }
  });
// A checked "unknown" clock ignores stale form values, including invalid or null hour/minute.
export const BirthInputSchema = z.preprocess((raw) => {
  if (raw !== null && typeof raw === 'object' && 'timeUnknown' in raw && raw.timeUnknown === true) {
    return { ...raw, hour: undefined, minute: undefined };
  }
  return raw;
}, birthInputObject);
function validGregorianDate(date: { year: number; month: number; day: number }): boolean {
  const leap = date.year % 4 === 0 && (date.year % 100 !== 0 || date.year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return date.day <= days[date.month - 1]!;
}
const localDateTime = z.object({ year: z.number().int(), month, day, hour, minute }).strict();
export const NormalizedBirthSchema = z
  .object({
    local: localDateTime.extend({
      hour: hour.nullable(),
      minute: minute.nullable(),
      tz: z.string().min(1),
    }),
    utc: z.string().datetime().nullable(),
    jd: z.number().finite().nullable(),
    timeUnknown: z.boolean(),
    place: z
      .object({
        lat: z.number().min(-90).max(90).nullable(),
        lng: z.number().min(-180).max(180).nullable(),
        tz: z.string().min(1),
        name: z.string().optional(),
      })
      .strict(),
    gender: z.nativeEnum(Gender),
    solarTime: z
      .object({
        enabled: z.boolean(),
        offsetMinutes: z.number().finite().nullable(),
        local: localDateTime.nullable(),
        // DESIGN-GAP: Add correction components required by 04 §2.3 for professional-view debugging.
        longitudeCorrectionMinutes: z.number().finite().nullable(),
        equationOfTimeMinutes: z.number().finite().nullable(),
      })
      .strict(),
    // DESIGN-GAP: yearGanZhi uses the shared structured pair rather than a translated display string.
    lunar: z
      .object({
        year: z.number().int(),
        month,
        isLeap: z.boolean(),
        day: day.max(30),
        yearGanZhi: GanZhiSchema,
      })
      .strict(),
    // DESIGN-GAP: Carry normalization warnings with the birth so compute can preserve them without mutable side channels.
    warnings: z.array(EngineWarningSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !validGregorianDate(value.local) ||
      (value.solarTime.local && !validGregorianDate(value.solarTime.local))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['local'],
        message: 'engine.errors.E_INVALID_INPUT',
      });
    }
    const unknown = value.local.hour === null && value.local.minute === null;
    if (
      unknown !== value.timeUnknown ||
      (value.local.hour === null) !== (value.local.minute === null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['local'],
        message: 'engine.errors.E_INVALID_INPUT',
      });
    }
    if (
      value.place.tz !== value.local.tz ||
      (value.utc === null) !== (value.jd === null) ||
      value.solarTime.enabled !== (value.place.lng !== null) ||
      ((value.timeUnknown || !value.solarTime.enabled) && value.solarTime.local !== null)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'engine.errors.E_INVALID_INPUT' });
    }
  });
