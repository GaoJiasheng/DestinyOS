import { expect, type Locator } from '@playwright/test';
/** Decode visible chart artwork before capturing the scope's normal layout. */
export async function settleArtwork(scope: Locator): Promise<void> {
  // DESIGN-GAP: Component screenshots scroll after font readiness and can trigger lazy paintings; visit only visible artwork without altering production loading.
  for (const image of await scope.locator('[data-art] img').filter({ visible: true }).all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
    await image.evaluate((node: HTMLImageElement) => node.decode());
  }
  await scope.scrollIntoViewIfNeeded();
}
