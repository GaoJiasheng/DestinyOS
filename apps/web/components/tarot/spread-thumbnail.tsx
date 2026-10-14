'use client';
const spreadAssets = {
  single: 'single',
  yes_no: 'yes-no',
  three_ppf: 'three-ppf',
  three_sao: 'three-sao',
  relationship: 'relationship',
  decision: 'decision',
  celtic_cross: 'celtic-cross',
  year_ahead: 'year-ahead',
} as const;
import { ArtImage } from '@/components/art/art-image';
import { useTranslations } from 'next-intl';
import type { SpreadKey } from '@tianji/shared';
/** Coordinate thumbnail shared by selection and the mobile report overview. */
// DESIGN-GAP: Painted tabletop angles describe the spread topology and card count; interactive card rotations remain defined by TAROT_SPREADS.
export function SpreadThumbnail({ spread }: { spread: SpreadKey }) {
  const t = useTranslations('tarot');
  return (
    <ArtImage
      asset={`spreads/${spreadAssets[spread]}`}
      alt={`${t(`spread.${spread}.name`)} · ${t('layout')}`}
      className="tarot-thumbnail"
      sizes="(min-width: 1024px) 240px, 160px"
    />
  );
}
