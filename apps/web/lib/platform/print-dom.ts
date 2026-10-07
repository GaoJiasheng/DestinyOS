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

/** Measure a fixed A4 layout at 200 DPI on a 1654px canvas, without changing its line wrapping. */
export function sizePoster(): number {
  const root = document.querySelector<HTMLElement>('.print-report');
  if (!root) throw new Error('Missing poster');
  const a4Width = (210 * 96) / 25.4;
  root.style.width = `${a4Width}px`;
  root.style.zoom = String(1654 / a4Width);
  root.dataset.posterScale = '1';
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

/** Uniformly shrink the fixed A4 geometry, stopping at a 9pt body size at 200 DPI.
 * @param height Maximum output height in pixels; returns the measured result (possibly over budget).
 */
export function limitPosterHeight(height: number): number {
  const root = document.querySelector<HTMLElement>('.print-report');
  if (!root) throw new Error('Missing poster');
  const initialZoom = Number(root.style.zoom);
  const initialHeight = root.getBoundingClientRect().height;
  const bodyPixels = parseFloat(getComputedStyle(root).fontSize) * initialZoom;
  const minimumScale = Math.min(1, (9 * 200) / 72 / bodyPixels);
  // DESIGN-GAP: Center a uniformly reduced A4 sheet on the fixed canvas; its logical width and existing line breaks never change.
  const ratio = Math.max(minimumScale, Math.min(1, (height - 2) / initialHeight));
  root.style.zoom = String(initialZoom * ratio);
  root.dataset.posterScale = String(ratio);
  // DESIGN-GAP: Preserve both QR codes at their original output dimensions and quiet borders; remeasure their extra height after scaling.
  for (const qr of root.querySelectorAll<HTMLElement>(
    '.print-end-qr img, .print-cover-bottom img',
  )) {
    if (getComputedStyle(qr).display === 'none') continue;
    qr.style.width = qr.style.height = `${180 / (initialZoom * ratio)}px`;
    qr.style.padding = `${12 / (initialZoom * ratio)}px`;
  }
  // QR growth can add height; one correction keeps the same layout and respects the type floor.
  const measured = root.getBoundingClientRect().height;
  if (measured > height && ratio > minimumScale) {
    const corrected = Math.max(minimumScale, (ratio * (height - 2)) / measured);
    root.style.zoom = String(initialZoom * corrected);
    root.dataset.posterScale = String(corrected);
    for (const qr of root.querySelectorAll<HTMLElement>(
      '.print-end-qr img, .print-cover-bottom img',
    )) {
      if (getComputedStyle(qr).display === 'none') continue;
      qr.style.width = qr.style.height = `${180 / (initialZoom * corrected)}px`;
      qr.style.padding = `${12 / (initialZoom * corrected)}px`;
    }
  }
  return Math.ceil(root.getBoundingClientRect().height);
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
  for (const quality of [0.8, 0.76, 0.72, 0.7]) {
    result = canvas.toDataURL('image/jpeg', quality);
    if ((result.length - result.indexOf(',') - 1) * 0.75 <= 3000000) break;
  }
  return result;
}
