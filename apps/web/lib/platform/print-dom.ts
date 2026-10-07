/** Check the existing print-ready/error sentinel inside either browser adapter. */
export function printSettled(): boolean {
  return ['true', 'error'].includes(
    document.querySelector('.print-report')?.getAttribute('data-ready') ?? '',
  );
}
/** Scale the report to the existing 2480px, 300-DPI A4 screenshot width.
 * @param node Print-report root evaluated inside the browser page.
 */
export function zoomPrintReport(node: Element): void {
  (node as HTMLElement).style.zoom = String(2480 / ((210 * 96) / 25.4));
}
/** Display only the selected print sheet and reset the screenshot scroll position.
 * @param nodes Ordered print sheets evaluated inside the browser page.
 * @param selected Zero-based sheet index.
 */
export function selectPrintSheet(nodes: Element[], selected: number): void {
  nodes.forEach((node, i) => {
    (node as HTMLElement).style.display = i === selected ? '' : 'none';
  });
  window.scrollTo(0, 0);
}

/** Set poster width before measuring its natural height; no sheet visibility or clipping is used. */
export function sizePoster(width: number): number {
  const root = document.querySelector<HTMLElement>('.print-report');
  if (!root) throw new Error('Missing poster');
  root.style.width = `${width}px`;
  window.scrollTo(0, 0);
  return Math.ceil(root.getBoundingClientRect().height);
}
/** Re-encode embedded bitmap assets as JPEG 80, retaining all report text and charts as vectors. */
export async function compressPrintImages(): Promise<void> {
  for (const img of document.querySelectorAll<HTMLImageElement>('.print-pages img')) {
    const canvas = document.createElement('canvas');
    // DESIGN-GAP: Decorative bitmap art is capped at 2x its print area (192 DPI); QR assets keep their native pixels and data charts remain SVG.
    const box = img.getBoundingClientRect();
    const scale =
      img.closest('[data-art]') && box.width > 0 && box.height > 0
        ? Math.min(1, (box.width * 2) / img.naturalWidth, (box.height * 2) / img.naturalHeight)
        : 1;
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image encoder unavailable');
    const root = document.querySelector('.print-report');
    context.fillStyle = root ? getComputedStyle(root).getPropertyValue('--bg-0').trim() : '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL('image/jpeg', 0.8);
    // A picture source overrides img.src; remove responsive sources only in the cloned print pages after decoding their actual bitmap.
    img
      .closest('picture')
      ?.querySelectorAll('source')
      .forEach((source) => source.remove());
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.src = encoded;
    await img.decode();
  }
}

/** Uniformly compact exceptionally tall posters without cropping or creating another sheet. */
export function limitPosterHeight(height: number): void {
  const root = document.querySelector<HTMLElement>('.print-report');
  if (!root) throw new Error('Missing poster');
  const width = root.getBoundingClientRect().width;
  // DESIGN-GAP: Wider logical text reflows as zoom changes, so measure a bounded binary search instead of over-shrinking by the original height ratio.
  let low = Math.min(1, (height - 2) / root.getBoundingClientRect().height);
  let high = 1;
  const apply = (ratio: number) => {
    root.style.width = `${width / ratio}px`;
    root.style.zoom = String(ratio);
    // DESIGN-GAP: Keep the final QR at 180 physical pixels with a 12px quiet border even when an exceptionally long poster is scaled.
    for (const qr of root.querySelectorAll<HTMLElement>('.print-end-qr img')) {
      qr.style.width = qr.style.height = `${180 / ratio}px`;
      qr.style.padding = `${12 / ratio}px`;
    }
    return root.getBoundingClientRect().height;
  };
  for (let i = 0; i < 10; i++) {
    const ratio = (low + high) / 2;
    if (apply(ratio) <= height - 2) low = ratio;
    else high = ratio;
  }
  apply(low);
}
/** Compress the already-captured JPEG on the browser, usable in Workers without a native addon. */
export async function compressPoster(dataUrl: string): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image encoder unavailable');
  context.drawImage(image, 0, 0);
  let result = dataUrl;
  for (const quality of [0.76, 0.68, 0.6, 0.5, 0.4]) {
    result = canvas.toDataURL('image/jpeg', quality);
    if ((result.length - result.indexOf(',') - 1) * 0.75 <= 3000000) break;
  }
  return result;
}
