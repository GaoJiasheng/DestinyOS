'use client';
import type { Mutagen, StarKey, ZiweiChart } from '@tianji/shared';
import { useTranslations } from 'next-intl';

type PalaceData = ZiweiChart['palaces'][number];
type Star = PalaceData['minorStars'][number];
const challenging: readonly StarKey[] = [
  'qing_yang',
  'tuo_luo',
  'huo_xing',
  'ling_xing',
  'di_kong',
  'di_jie',
];

/** Text-labelled transformation badge; source distinguishes natal, decade and yearly layers. */
export function MutagenBadge({
  value,
  source,
}: {
  value: Mutagen;
  source: 'birthMutagen' | 'yearMutagen' | 'decadeMutagen';
}) {
  const t = useTranslations('ziwei.chart');
  return (
    <span
      className={`ziwei-mutagen ziwei-mutagen-${value}`}
      data-source={source}
      aria-label={`${t(source)} · ${t(`mutagen.${value}`)}`}
      title={`${t(source)} · ${t(`mutagen.${value}`)}`}
    >
      {source === 'yearMutagen' ? <span aria-hidden>↗</span> : null}
      {t(`mutagen.${value}`)}
    </span>
  );
}

/** Render star names, brightness and every applicable natal/yearly transformation without replacing natal data. */
export function ZiweiStars({
  stars,
  major = false,
  compact = false,
  yearly,
}: {
  stars: readonly Star[];
  major?: boolean;
  compact?: boolean;
  yearly?: ZiweiChart['horoscope']['yearly']['mutagens'];
}) {
  // DESIGN-GAP: English names absent from the glossary use conventional romanized star/cycle names in the catalog.
  const t = useTranslations('ziwei.chart');
  return (
    <span className="ziwei-stars">
      {stars.map((star) => (
        <span
          key={star.key}
          className={
            major
              ? 'ziwei-major'
              : challenging.includes(star.key)
                ? 'ziwei-challenging'
                : 'ziwei-supporting'
          }
        >
          {t(`${compact && major ? 'compactStar' : 'star'}.${star.key}`)}
          {star.brightness ? (
            <small className="ziwei-brightness">{t(`brightness.${star.brightness}`)}</small>
          ) : null}
          {star.mutagen ? <MutagenBadge value={star.mutagen} source="birthMutagen" /> : null}
          {yearly
            ? (Object.entries(yearly) as [Mutagen, StarKey][])
                .filter(([, key]) => key === star.key)
                .map(([value]) => <MutagenBadge key={value} value={value} source="yearMutagen" />)
            : null}
        </span>
      ))}
    </span>
  );
}

/** Interactive palace cell with compact major stars, decade range and separate annual marker. */
export function ZiweiPalace({
  palace,
  selected,
  related,
  current,
  yearly,
  annualPalace,
  onSelect,
  position,
  compact = true,
}: {
  palace: PalaceData;
  selected: boolean;
  related: boolean;
  current: boolean;
  yearly?: ZiweiChart['horoscope']['yearly']['mutagens'];
  annualPalace: boolean;
  onSelect: () => void;
  position: readonly [number, number];
  compact?: boolean;
}) {
  const t = useTranslations('ziwei.chart');
  // DESIGN-GAP: Thumbnail labels omit explanatory English suffixes; accessible labels and expanded/detail views retain full names.
  const b = useTranslations('bazi');
  return (
    <button
      type="button"
      className="ziwei-palace"
      data-palace={palace.key}
      data-branch={palace.branch}
      data-related={related}
      data-current={current}
      aria-pressed={selected}
      aria-label={`${t(`palace.${palace.key}`)} · ${b(`branches.${palace.branch}`)}`}
      style={{ gridColumn: position[0] + 1, gridRow: position[1] + 1 }}
      onClick={onSelect}
    >
      <span className="ziwei-palace-heading">
        <span className="ziwei-seal">
          {t(`${compact ? 'compactPalace' : 'palace'}.${palace.key}`)}
        </span>
        <span>
          {b(`stems.${palace.stem}`)}
          {b(`branches.${palace.branch}`)}
        </span>
        {palace.isBodyPalace ? (
          <span className="ziwei-body">{t(compact ? 'bodyCompact' : 'body')}</span>
        ) : null}
      </span>
      <ZiweiStars stars={palace.majorStars} major compact={compact} yearly={yearly} />
      {!palace.majorStars.length ? (
        <span className="ziwei-empty" title={t('empty')}>
          {t(compact ? 'emptyCompact' : 'empty')}
        </span>
      ) : null}
      <span className="ziwei-cell-minor">
        <ZiweiStars stars={palace.minorStars} yearly={yearly} />
      </span>
      {annualPalace ? <span className="ziwei-annual">{t('yearPalace')}</span> : null}
      <span
        className="ziwei-palace-age"
        title={t('ageRange', { from: palace.decadal.fromAge, to: palace.decadal.toAge })}
      >
        {t(compact ? 'ageCompact' : 'ageRange', {
          from: palace.decadal.fromAge,
          to: palace.decadal.toAge,
        })}
      </span>
    </button>
  );
}
