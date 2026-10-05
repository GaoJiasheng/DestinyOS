import { expect, it } from 'vitest';
import { Branch } from '@tianji/shared';
import { loadRectificationFeatures, RectificationFeaturesSchema } from '../scripts/rectification';
it('provides one nonempty bilingual observation prompt for each of twelve hours', async () => {
  const RECTIFICATION_FEATURES = await loadRectificationFeatures();
  expect(Object.keys(RECTIFICATION_FEATURES)).toEqual(Object.values(Branch));
  for (const feature of Object.values(RECTIFICATION_FEATURES)) {
    expect(feature.zh.length).toBeGreaterThan(10);
    expect(feature.en.length).toBeGreaterThan(20);
  }
});

it('rejects missing hours, missing locales, and unknown keys', async () => {
  const features = await loadRectificationFeatures();
  const { zi, ...missing } = features;
  expect(RectificationFeaturesSchema.safeParse(missing).success).toBe(false);
  expect(RectificationFeaturesSchema.safeParse({ ...features, zi: { zh: zi!.zh } }).success).toBe(
    false,
  );
  expect(RectificationFeaturesSchema.safeParse({ ...features, other: zi }).success).toBe(false);
});
