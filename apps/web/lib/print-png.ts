import sharp from 'sharp';
/** Losslessly optimize Chromium pixels and embed 300dpi physical resolution; no palette reduction or resizing. */
export async function printPng(data: Uint8Array): Promise<Uint8Array> {
  return sharp(data)
    .withMetadata({ density: 300 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}
