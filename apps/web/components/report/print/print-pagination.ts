// DESIGN-GAP: Measure explicit columns instead of relying on browser-specific multicolumn pagination; split prose at words/CJK characters and keep headings with the next block.
/** Flow all chapters through two A4 columns, sharing page one with the cover and chart. */
function flowPrint(root: Element): void {
  const output = root.querySelector<HTMLElement>('.print-pages');
  const template = root.querySelector<HTMLElement>('[data-sheet-template]');
  const source = root.querySelector<HTMLElement>('.print-source');
  if (!output || !template || !source) throw new Error('Missing print structure');
  output.replaceChildren();
  let column: HTMLElement;
  let second: HTMLElement;
  let columnIndex = 0;
  const addPage = (first = false) => {
    const sheet = template.firstElementChild?.cloneNode(true);
    if (!(sheet instanceof HTMLElement)) throw new Error('Missing A4 template');
    sheet.className = 'print-sheet';
    output.append(sheet);
    const area = sheet.querySelector<HTMLElement>('.print-page-template-content');
    if (!area) throw new Error('Missing A4 content area');
    area.className = 'print-page-content';
    if (first) {
      const intro = document.createElement('div');
      intro.className = 'print-intro';
      for (const key of ['cover', 'chart']) {
        const section = source.querySelector(`[data-print-section="${key}"]`);
        if (!section) throw new Error('Missing report introduction');
        intro.append(section.cloneNode(true));
      }
      area.append(intro);
    }
    const columns = document.createElement('div');
    columns.className = 'print-columns';
    column = document.createElement('div');
    second = document.createElement('div');
    column.className = second.className = 'print-column';
    columns.append(column, second);
    area.append(columns);
    columnIndex = 0;
    if (output.children.length > 80) throw new Error('Report exceeds print page budget');
  };
  const next = () => {
    if (columnIndex === 0) {
      column = second;
      columnIndex = 1;
    } else addPage();
  };
  const overflow = () => column.scrollHeight > column.clientHeight + 1;
  addPage(true);
  const blocks = Array.from(source.querySelectorAll<HTMLElement>('[data-print-section]'))
    .filter((section) => !['cover', 'chart'].includes(section.dataset.printSection ?? ''))
    .flatMap((section) => Array.from(section.children) as HTMLElement[]);
  for (let i = 0; i < blocks.length; i++) {
    const original = blocks[i]!;
    let clone = original.cloneNode(true) as HTMLElement;
    column!.append(clone);
    // Avoid a chapter title orphaned at the foot of a column.
    if (clone.matches('h2, h3, .print-chapter-heading') && blocks[i + 1]) {
      const probe = blocks[i + 1]!.cloneNode(true) as HTMLElement;
      // Reserve the opening three lines, not an entire paragraph that may span columns.
      probe.style.maxHeight = `${parseFloat(getComputedStyle(column!).lineHeight) * 3}px`;
      probe.style.overflow = 'hidden';
      column!.append(probe);
      const fits = !overflow();
      probe.remove();
      if (!fits) {
        clone.remove();
        if (column!.children.length) next();
        column!.append(clone);
      }
    }
    if (!overflow()) continue;
    clone.remove();
    // Fill the remaining column with prose before continuing in the next column.
    const splittable = clone.matches('p, .print-advice, .print-action, .print-footnote');
    if (!splittable) {
      if (column!.children.length) next();
      column!.append(clone);
      if (overflow()) throw new Error('Oversized atomic print block');
      continue;
    }
    const text = clone.textContent ?? '';
    const tokens = text.match(/[\u2e80-\u9fff]|[^\s\u2e80-\u9fff]+\s*|\s+/gu) ?? [];
    clone.textContent = '';
    column!.append(clone);
    for (const token of tokens) {
      const previous = clone.textContent ?? '';
      clone.textContent = previous + token;
      if (!overflow()) continue;
      clone.textContent = previous;
      if (!previous) clone.remove();
      if (!column!.children.length) throw new Error('Unbreakable print token');
      next();
      clone = document.createElement('p');
      clone.className = original.className;
      clone.dataset.printBlock = '';
      clone.textContent = token;
      column!.append(clone);
      if (overflow()) throw new Error('Unbreakable print token');
    }
  }
  const pages = Array.from(output.children);
  pages.forEach((page, i) => {
    page.querySelector('[data-page-number]')!.textContent = `${i + 1} / ${pages.length}`;
  });
}

/** Fit complete snapshots within the format budget while preserving point size and line height. */
export function paginatePrint(root: Element): void {
  if (!(root instanceof HTMLElement)) throw new Error('Missing report root');
  const limit = ['iching', 'qimen', 'tarot'].includes(root.dataset.system ?? '') ? 3 : 6;
  // DESIGN-GAP: Saved snapshots can exceed 7000 English words. Progressively use condensed column typography, retaining the requested 9/9.5pt height, 1.55 leading and every word; never shrink charts or crop text.
  for (const density of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]) {
    root.style.setProperty('--print-density', String(density));
    flowPrint(root);
    root.dataset.density = String(density);
    if (root.querySelectorAll('.print-sheet').length <= limit) return;
  }
  throw new Error('Complete report exceeds compact PDF page budget');
}
