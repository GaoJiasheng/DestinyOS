import { z } from 'zod';
const loaded = new Set<string>();
const schema = z.object({
  initial: z.object({ wenkai: z.number(), noto: z.number() }),
  fonts: z.array(
    z.object({
      file: z.string().regex(/^(wenkai|noto)-body-\d+\.woff2$/),
      bytes: z.number().positive(),
      chars: z.string(),
      family: z.enum(['wenkai', 'noto']),
    }),
  ),
});
/** Choose body glyph shards by actual text usage, with hard per-page and per-family byte caps. */
export async function selectBodyFonts() {
  const response = await fetch('/fonts/selection.json');
  if (!response.ok) return;
  const inventory = schema.parse(await response.json());
  const frequencies = { wenkai: new Map<string, number>(), noto: new Map<string, number>() };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
      const style = getComputedStyle(parent);
      const family = style.fontFamily.includes('LXGW WenKai')
        ? 'wenkai'
        : style.fontFamily.includes('Noto Serif SC')
          ? 'noto'
          : null;
      if (family && style.display !== 'none')
        for (const char of node.textContent ?? '')
          frequencies[family].set(char, (frequencies[family].get(char) ?? 0) + 1);
    }
    node = walker.nextNode();
  }
  const ranked = inventory.fonts
    .map((font) => ({
      ...font,
      benefit: [...font.chars].reduce((sum, c) => sum + (frequencies[font.family].get(c) ?? 0), 0),
    }))
    .filter((font) => font.benefit > 0)
    .sort((a, b) => b.benefit / b.bytes - a.benefit / a.bytes || a.file.localeCompare(b.file));
  const used = { ...inventory.initial };
  const chosen = inventory.fonts.filter((font) => loaded.has(font.file));
  for (const font of chosen) used[font.family] += font.bytes;
  for (const font of ranked) {
    if (loaded.has(font.file)) continue;
    if (
      used[font.family] + font.bytes > (font.family === 'wenkai' ? 180 : 300) * 1024 ||
      used.wenkai + used.noto + font.bytes > 350 * 1024
    )
      continue;
    used[font.family] += font.bytes;
    chosen.push(font);
    loaded.add(font.file);
  }
  // DESIGN-GAP: Budget-limited pages retain native serif fallback for less-used glyphs; all common/term shards remain available locally and no page text is sent to a server.
  let sheet = document.querySelector<HTMLStyleElement>('style[data-body-fonts]');
  if (!sheet) {
    sheet = document.createElement('style');
    sheet.dataset.bodyFonts = 'true';
    document.head.append(sheet);
  }
  sheet.textContent = chosen
    .map(
      (font) =>
        `@font-face{font-family:'${font.family === 'wenkai' ? 'LXGW WenKai' : 'Noto Serif SC'}';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/${font.file}') format('woff2');unicode-range:${[...font.chars].map((c) => 'U+' + c.codePointAt(0)!.toString(16)).join(',')};}`,
    )
    .join('\n');
  document.documentElement.dataset.fontBudget = String(used.wenkai + used.noto);
}
