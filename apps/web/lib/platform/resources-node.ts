import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
/** Resolve traced resources from the Next.js app root or monorepo root, including Vitest's workspace cwd. */
export function webDirectory(): string {
  // DESIGN-GAP: Next.js runs from apps/web while workspace tests run from the repository root.
  return existsSync(resolve(process.cwd(), 'resources/cities500.json.gz'))
    ? process.cwd()
    : resolve(process.cwd(), 'apps/web');
}

/** Read a traced public resource relative to the application root.
 * @param path Trusted app-relative build artifact path.
 */
export function nodeResourceBytes(path: string): Promise<Buffer> {
  return readFile(resolve(webDirectory(), path));
}
/** List a traced public-resource directory relative to the application root.
 * @param path Trusted app-relative resource directory.
 */
export function nodeResourceNames(path: string): Promise<string[]> {
  return readdir(resolve(webDirectory(), path));
}
