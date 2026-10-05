import { TAROT_MAJOR_CARDS } from './tarot-major-cards';
import { TAROT_WANDS } from './tarot-wands';
import { TAROT_CUPS } from './tarot-cups';
import { TAROT_SWORDS } from './tarot-swords';
import { TAROT_PENTACLES } from './tarot-pentacles';
// DESIGN-GAP: Stable deck order is majors 0–21, then wands/cups/swords/pentacles Ace–King.
// DESIGN-GAP: Astrology mirrors content/tarot/cards.yaml; courts use their principal zodiac sign and elemental majors use modern rulers.
export const TAROT_CARDS = [
  ...TAROT_MAJOR_CARDS,
  ...TAROT_WANDS,
  ...TAROT_CUPS,
  ...TAROT_SWORDS,
  ...TAROT_PENTACLES,
] as const;
export type CardKey = (typeof TAROT_CARDS)[number]['key'];
