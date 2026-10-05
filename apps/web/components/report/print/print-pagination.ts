// DESIGN-GAP: Browser-measured atomic blocks preserve each chapter's fresh-page start; oversized prose splits at word/character boundaries without changing typography.
/** Lay out source blocks in identical fixed A4 areas for screenshot and PDF output. */
export function paginatePrint(root: HTMLElement): void {
  const output = root.querySelector<HTMLElement>('.print-pages');
  const template = root.querySelector<HTMLElement>('[data-sheet-template]');
  if (!output || !template) throw new Error('Missing print structure');
  output.replaceChildren();
  let content: HTMLElement;
  const addPage = (section: string) => {
    const sheet = template.firstElementChild?.cloneNode(true);
    if (!(sheet instanceof HTMLElement)) throw new Error('Missing A4 template');
    sheet.dataset.section = section;
    sheet.className = 'print-sheet';
    output.append(sheet);
    const area = sheet.querySelector<HTMLElement>('.print-page-template-content');
    if (!area) throw new Error('Missing A4 content area');
    area.className = 'print-page-content';
    content = area;
    if (output.children.length > 80) throw new Error('Report exceeds print page budget');
  };
  const overflow = () => content.scrollHeight > content.clientHeight + 1;
  for (const section of root.querySelectorAll<HTMLElement>('[data-print-section]')) {
    const sectionKey = section.dataset.printSection!;
    addPage(sectionKey);
    for (const block of section.children) {
      let clone = block.cloneNode(true) as HTMLElement;
      content!.append(clone);
      if (!overflow()) continue;
      clone.remove();
      if (content!.children.length) addPage(sectionKey);
      content!.append(clone);
      if (!overflow()) continue;
      if (clone.tagName !== 'P') throw new Error('Oversized atomic print block');
      const text = clone.textContent ?? '';
      const words = text.match(/\S+\s*|\s+/gu) ?? [];
      const tokens = words.length < 2 ? Array.from(text) : words;
      clone.textContent = '';
      for (const token of tokens) {
        const previous = clone.textContent ?? '';
        clone.textContent = previous + token;
        if (!overflow()) continue;
        if (!previous) throw new Error('Unbreakable print token');
        clone.textContent = previous;
        addPage(sectionKey);
        clone = document.createElement('p');
        clone.dataset.printBlock = '';
        clone.textContent = token;
        content!.append(clone);
      }
    }
  }
  const pages = Array.from(output.children);
  pages.forEach((page, i) => {
    page.querySelector('[data-page-number]')!.textContent = `${i + 1} / ${pages.length}`;
  });
}
