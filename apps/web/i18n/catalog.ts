import zh from '../messages/zh.json';
export type MessageKey = keyof typeof zh;
export type Catalog = Record<string, string>;
export type MessageTree = { [key: string]: string | MessageTree };
// DESIGN-GAP: The documented timeUnknown key is both a message and a namespace.
// Keep every exact dotted key in the source catalogs; use __value only in the runtime tree.
export { runtimeKey } from './runtime-key';
/** Expand exact dotted source keys into the message namespaces required by next-intl. */
export function toMessages(catalog: Catalog): MessageTree {
  const result: MessageTree = {};
  // DESIGN-GAP: Resolve flat-key namespace collisions once; repeated quadratic scans slow the full static encyclopedia build.
  const parents = new Set<string>();
  for (const key of Object.keys(catalog)) {
    const parts = key.split('.');
    for (let index = 1; index < parts.length; index++) parents.add(parts.slice(0, index).join('.'));
  }
  for (const [key, value] of Object.entries(catalog)) {
    const segments = (parents.has(key) ? `${key}.__value` : key).split('.');
    if (segments.some((segment) => ['__proto__', 'constructor', 'prototype'].includes(segment)))
      throw new Error('Reserved translation key');
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
