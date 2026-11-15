import compile from 'icu-minify/compile';
import type { AbstractIntlMessages } from 'next-intl';

// DESIGN-GAP: Browser and SSR bundles format with use-intl's parser-free format-only runtime (next.config.ts), so every catalog handed to a client provider is compiled here on the server.
// Catalogs are immutable per deployment, so caching by source text bounds the work to one compile per distinct message per isolate.
const compiled = new Map<string, unknown>();

function compileMessage(message: string): unknown {
  let result = compiled.get(message);
  if (result === undefined) {
    const output = compile(message);
    // Plural/select branches are null-prototype objects, which React refuses to pass to Client Components; plain text stays a string.
    result = typeof output === 'string' ? output : JSON.parse(JSON.stringify(output));
    compiled.set(message, result);
  }
  return result;
}

// DESIGN-GAP: Flight serializes a shared object once; providers on one page reuse the same request-config subtrees (e.g. `common`), so identical inputs must map to identical outputs or every provider repeats them.
const trees = new WeakMap<AbstractIntlMessages, AbstractIntlMessages>();

/** Compile an ICU message tree for the parser-free client formatter; keys and nesting are unchanged. */
export function precompileMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const existing = trees.get(messages);
  if (existing) return existing;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(messages))
    result[key] = typeof value === 'string' ? compileMessage(value) : precompileMessages(value);
  // Compiled leaves are opaque arrays; next-intl's client formatter accepts them in place of strings.
  const compiledTree = result as AbstractIntlMessages;
  trees.set(messages, compiledTree);
  return compiledTree;
}
