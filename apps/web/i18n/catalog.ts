import zh from '../messages/zh.json';
export type MessageKey = keyof typeof zh;
export type Catalog = Record<string, string>;
export type MessageTree = { [key: string]: string | MessageTree };
// DESIGN-GAP: The documented timeUnknown key is both a message and a namespace.
// Keep every exact dotted key in the source catalogs; use __value only in the runtime tree.
/** Convert an exact catalog key to the next-intl tree path, preserving parent messages. */
export function runtimeKey(key: string, catalog: Catalog = zh): string {
  return Object.keys(catalog).some((entry) => entry.startsWith(`${key}.`)) ? `${key}.__value` : key;
}
/** Expand exact dotted source keys into the message namespaces required by next-intl. */
export function toMessages(catalog: Catalog): MessageTree {
  const result: MessageTree = {};
  for (const [key, value] of Object.entries(catalog)) {
    const segments = runtimeKey(key, catalog).split('.');
    let node = result;
    for (const segment of segments.slice(0, -1)) {
      const child = node[segment];
      if (typeof child === 'string') throw new Error(`Message namespace collision: ${key}`);
      node[segment] = child ?? {};
      node = node[segment];
    }
    const leaf = segments.at(-1);
    if (leaf) node[leaf] = value;
  }
  return result;
}
