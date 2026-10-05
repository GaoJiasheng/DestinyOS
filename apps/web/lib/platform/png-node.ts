import sharp from 'sharp';
/** Optimize lossless PNG pixels and embed the documented 300dpi density on Node. */
export async function optimizePng(data: Uint8Array): Promise<Uint8Array> {
  return sharp(data)
    .withMetadata({ density: 300 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}
