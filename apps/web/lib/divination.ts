import { Temporal } from '@js-temporal/polyfill';
import { compute, EngineError } from '@tianji/engine';
import { IchingChartSchema, QimenChartSchema } from '@tianji/shared';
import type { ReadingRequest } from './reading-schema';
/** Build a zoned civil clock, rejecting nonexistent DST times rather than silently shifting them. */
export function castClock(local: string, tz: string): string {
  return Temporal.ZonedDateTime.from(`${local}[${tz}]`, { disambiguation: 'reject' }).toString();
}
/** Adapt the private UI clock to the documented pure-engine input, preserving engine metadata. */
export function computeDivinationResult(req: ReadingRequest) {
  const question = typeof req.question === 'object' ? req.question : {};
  const { text, at, ...rest } = question;
  const meihuaAt =
    rest.meihua && typeof rest.meihua === 'object' && 'at' in rest.meihua
      ? rest.meihua.at
      : undefined;
  const clock = at ?? meihuaAt;
  if (typeof clock !== 'string') throw new EngineError('E_INVALID_INPUT');
  return compute({
    system: req.system,
    now: Temporal.ZonedDateTime.from(clock),
    question: {
      ...rest,
      ...(req.system === 'qimen' ? { at } : {}),
      category: req.category ?? rest.category ?? (req.system === 'qimen' ? 'general' : 'other'),
      ...(req.system === 'iching' ? { method: req.method ?? rest.method ?? 'meihua' } : {}),
      ...(typeof text === 'string' && text ? { question: text } : {}),
    },
    seed: req.seed ?? req.idempotencyKey,
    options: req.options,
  });
}
/** Compute the exact chart used by the ritual, server persistence and offline fallback. */
export function computeDivination(req: ReadingRequest) {
  const result = computeDivinationResult(req);
  return req.system === 'iching'
    ? IchingChartSchema.parse(result.chart)
    : QimenChartSchema.parse(result.chart);
}
