import sharp from 'sharp';

/** Reject the SDK's full-width development banner in original native captures. */
export async function checkNativeScreenshot(bytes: Buffer, name: string): Promise<void> {
  // DESIGN-GAP: Apply the existing store-capture overlay rule to every native baseline;
  // retain original pixels and require recapture instead of cropping a diagnostic banner.
  const { data, info } = await sharp(bytes)
    .resize({ width: 128 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) {
    let blue = 0;
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset] ?? 0,
        green = data[offset + 1] ?? 0,
        channel = data[offset + 2] ?? 0;
      if (red > 20 && red < 65 && green > 110 && green < 165 && channel > 200) blue++;
    }
    if (blue / info.width > 0.9) throw new Error(`Recapture development overlay: ${name}`);
  }
}
