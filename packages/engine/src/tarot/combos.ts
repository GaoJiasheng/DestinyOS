import type { CardKey, TarotChart } from '@tianji/shared';
// DESIGN-GAP: §5 names four examples; complete the 30 with conventional RWS thematic pairs.
// Pairs are unordered, orientation-independent; a hit requires both distinct cards.
export const TAROT_COMBINATIONS: readonly { key: string; cards: readonly [CardKey, CardKey] }[] = [
  { key: 'lovers_two_cups', cards: ['major_06_lovers', 'cups_02'] },
  { key: 'tower_death', cards: ['major_16_tower', 'major_13_death'] },
  { key: 'sun_star', cards: ['major_19_sun', 'major_17_star'] },
  { key: 'three_swords_three_cups', cards: ['swords_03', 'cups_03'] },
  { key: 'fool_magician', cards: ['major_00_fool', 'major_01_magician'] },
  { key: 'priestess_moon', cards: ['major_02_high_priestess', 'major_18_moon'] },
  { key: 'empress_emperor', cards: ['major_03_empress', 'major_04_emperor'] },
  { key: 'hierophant_lovers', cards: ['major_05_hierophant', 'major_06_lovers'] },
  { key: 'chariot_strength', cards: ['major_07_chariot', 'major_08_strength'] },
  { key: 'hermit_priestess', cards: ['major_09_hermit', 'major_02_high_priestess'] },
  { key: 'wheel_world', cards: ['major_10_wheel_of_fortune', 'major_21_world'] },
  { key: 'justice_judgement', cards: ['major_11_justice', 'major_20_judgement'] },
  { key: 'hanged_man_death', cards: ['major_12_hanged_man', 'major_13_death'] },
  { key: 'temperance_star', cards: ['major_14_temperance', 'major_17_star'] },
  { key: 'devil_tower', cards: ['major_15_devil', 'major_16_tower'] },
  { key: 'moon_sun', cards: ['major_18_moon', 'major_19_sun'] },
  { key: 'judgement_world', cards: ['major_20_judgement', 'major_21_world'] },
  { key: 'magician_ace_wands', cards: ['major_01_magician', 'wands_01'] },
  { key: 'empress_ace_pentacles', cards: ['major_03_empress', 'pentacles_01'] },
  { key: 'lovers_ten_cups', cards: ['major_06_lovers', 'cups_10'] },
  { key: 'emperor_king_pentacles', cards: ['major_04_emperor', 'pentacles_king'] },
  { key: 'star_ace_cups', cards: ['major_17_star', 'cups_01'] },
  { key: 'sun_four_wands', cards: ['major_19_sun', 'wands_04'] },
  { key: 'death_ten_swords', cards: ['major_13_death', 'swords_10'] },
  { key: 'devil_eight_swords', cards: ['major_15_devil', 'swords_08'] },
  { key: 'hermit_four_swords', cards: ['major_09_hermit', 'swords_04'] },
  { key: 'wheel_two_pentacles', cards: ['major_10_wheel_of_fortune', 'pentacles_02'] },
  { key: 'justice_ace_swords', cards: ['major_11_justice', 'swords_01'] },
  { key: 'three_pentacles_eight_pentacles', cards: ['pentacles_03', 'pentacles_08'] },
  { key: 'five_cups_six_cups', cards: ['cups_05', 'cups_06'] },
];
/** Detect the thirty documented thematic pairs from unique drawn card keys. */
export function detectTarotCombinations(
  cards: readonly Pick<TarotChart['cards'][number], 'cardKey'>[],
): string[] {
  const keys = new Set(cards.map((card) => card.cardKey));
  return TAROT_COMBINATIONS.filter((rule) => rule.cards.every((key) => keys.has(key))).map(
    (rule) => rule.key,
  );
}
