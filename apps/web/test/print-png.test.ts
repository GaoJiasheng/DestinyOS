import { it, expect } from 'vitest';
import sharp from 'sharp';
import { printPng } from '../lib/print-png';
it('preserves every RGB pixel and dimensions while writing 300dpi metadata', async () => {
  const pixels = Buffer.from(Array.from({ length: 64 * 64 * 3 }, (_, i) => (i * 17) % 256));
  const input = await sharp(pixels, { raw: { width: 64, height: 64, channels: 3 } })
    .png()
    .toBuffer();
  const output = await printPng(input);
  const metadata = await sharp(output).metadata();
  expect(metadata.width).toBe(64);
  expect(metadata.height).toBe(64);
  expect(metadata.density).toBe(300);
  expect(await sharp(output).removeAlpha().raw().toBuffer()).toEqual(pixels);
});
