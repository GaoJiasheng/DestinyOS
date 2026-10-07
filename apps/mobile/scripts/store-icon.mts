import sharp from 'sharp';
import { fileURLToPath, URL } from 'node:url';
import { brand } from '@tianji/shared/brand';
import { designTokens } from '@tianji/ui-core/tokens';
const colors = designTokens.base;
// DESIGN-GAP: Use a code-drawn gold astrolabe to represent all traditions equally; Android foreground stays in the adaptive-icon safe area.
const symbol = `<g fill="none" stroke="${colors.gold}" stroke-width="12"><circle cx="512" cy="512" r="260"/><circle cx="512" cy="512" r="218"/><path d="M512 282 L652 652 L282 512 L652 372 L512 742 L372 372 L742 512 L372 652 Z"/><circle cx="512" cy="512" r="38" fill="${colors['gold-soft']}"/></g>`;
for (const adaptive of [false, true]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><title>${brand.nameEn}</title>${adaptive ? '' : `<rect width="1024" height="1024" fill="${colors['bg-0']}"/>`}${symbol}</svg>`;
  const image = sharp(Buffer.from(svg));
  if (!adaptive) image.removeAlpha();
  await image
    .png()
    .toFile(
      fileURLToPath(
        new URL(`../assets/${adaptive ? 'adaptive-icon' : 'icon'}.png`, import.meta.url),
      ),
    );
}
await sharp(fileURLToPath(new URL('../assets/icon.png', import.meta.url)))
  .resize(512, 512)
  .removeAlpha()
  .png()
  .toFile(fileURLToPath(new URL('../store/play-icon.png', import.meta.url)));
// Google Play's mandatory listing feature graphic, distinct from device screenshots.
await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500"><rect width="1024" height="500" fill="${colors['bg-0']}"/><g transform="translate(-30,-5) scale(.5)">${symbol}</g><text x="490" y="270" fill="${colors['gold-soft']}" font-family="serif" font-size="68">${brand.nameEn}</text></svg>`,
  ),
)
  .removeAlpha()
  .png()
  .toFile(fileURLToPath(new URL('../store/feature-graphic.png', import.meta.url)));
