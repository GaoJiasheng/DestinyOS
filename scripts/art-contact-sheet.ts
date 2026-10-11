import { readFile } from 'node:fs/promises';
import sharp, { type OverlayOptions } from 'sharp';
import { z } from 'zod';

const candidates = z
  .array(z.object({ id: z.string(), candidate: z.number(), path: z.string() }))
  .parse(JSON.parse(await readFile('.art-candidates.json', 'utf8')));
const groups = [...new Set(candidates.map((item) => item.id))].sort();
const start = Number(process.argv[2] ?? 0);
const selected = groups.slice(start, start + 4);
const composite: OverlayOptions[] = [];
for (const [row, id] of selected.entries()) {
  for (const item of candidates.filter((item) => item.id === id)) {
    const left = (item.candidate - 1) * 512;
    composite.push({
      input: await sharp(item.path)
        .resize(500, 470, { fit: 'contain', background: '#111628' })
        .png()
        .toBuffer(),
      left,
      top: row * 512 + 35,
    });
    // Contact-sheet labels are QA annotations, never production artwork.
    composite.push({
      input: Buffer.from(
        `<svg width="512" height="32"><text x="12" y="24" fill="#e8d3a3" font-size="18">${id} / ${item.candidate}</text></svg>`,
      ),
      left,
      top: row * 512,
    });
  }
}
await sharp({
  create: {
    width: 1024,
    height: Math.max(1, selected.length) * 512,
    channels: 4,
    background: '#111628',
  },
})
  .composite(composite)
  .png()
  .toFile(`test-results/art/contact-${start}.png`);
