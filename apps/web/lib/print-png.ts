import { platform } from './platform/environment';
/** Losslessly optimize Node captures; Workers embed 300dpi without native sharp. */
export async function printPng(data: Uint8Array): Promise<Uint8Array> {
  if (platform() === 'cloudflare') return pngDensity(data);
  return (await import('./platform/png-node')).optimizePng(data);
}
/** Add the standard PNG pHYs chunk without modifying pixels or requiring native binaries. */
// DESIGN-GAP: Workers retain Chromium's lossless PNG compression; only the 300dpi metadata is replaced.
export function pngDensity(data: Uint8Array): Uint8Array {
  if (data.length < 33 || data[0] !== 137 || data[1] !== 80) throw new Error('Invalid PNG');
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  view.setUint32(8, 11811);
  view.setUint32(12, 11811);
  chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const chunks: Uint8Array[] = [data.subarray(0, 33), chunk];
  const input = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let offset = 33; offset < data.length;) {
    const length = input.getUint32(offset) + 12;
    if (offset + length > data.length) throw new Error('Invalid PNG chunk');
    if (![0x70485973, 0x65584966].includes(input.getUint32(offset + 4)))
      chunks.push(data.subarray(offset, offset + length));
    offset += length;
  }
  const output = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    output.set(c, offset);
    offset += c.length;
  }
  return output;
}
