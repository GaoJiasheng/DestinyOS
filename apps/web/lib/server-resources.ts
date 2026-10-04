import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
/** Resolve traced resources from the Next.js app root or monorepo root, including Vitest's workspace cwd. */
export function webDirectory(): string {
  // DESIGN-GAP: Next.js runs from apps/web while workspace tests run from the repository root.
  return existsSync(resolve(process.cwd(), 'resources/cities500.json.gz'))
    ? process.cwd()
    : resolve(process.cwd(), 'apps/web');
}
