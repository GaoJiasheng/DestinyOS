import { type CardKey, type TarotChart } from '@tianji/shared';
/** Shared tarot fixture setup for the split regression suites. */
export const seed = 'test-seed-001';
/** Build ordered drawn-card fixtures without shuffling.
 * @param keys Card identifiers in draw order.
 * @param reversed Orientation applied to every fixture card. */
export const drawn = (keys: CardKey[], reversed = false): TarotChart['cards'] =>
  keys.map((cardKey, order) => ({ cardKey, position: String(order), order, reversed }));
/** Shared tarot fixture setup for the split regression suites. */
export type Bilingual = { zh: string; en: string };
/** Shared tarot fixture setup for the split regression suites. */
export const contentCardSchemaKeys = [
  'key',
  'number',
  'arcana',
  'suit',
  'element',
  'astrology',
  'numerology',
  'yesNo',
  'name',
  'keywordsUpright',
  'keywordsReversed',
  'meaningUpright',
  'meaningReversed',
  'imagery',
  'advice',
  'historySymbolism',
  'byCategory',
];
