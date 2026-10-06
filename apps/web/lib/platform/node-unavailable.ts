/** DESIGN-GAP: Cloudflare builds exclude Node-only binaries via webpack aliases; mis-selection fails closed. */
export function openNodePage(): never {
  throw new Error('Node browser unavailable in Workers');
}
/** Never fall back to ephemeral storage on Workers. */
export function readExport(): never {
  throw new Error('Node storage unavailable in Workers');
}
/** Never fall back to ephemeral storage on Workers. */
export function writeExport(): never {
  throw new Error('Node storage unavailable in Workers');
}
/** Cloudflare uses its JSON logger. */
export function createNodeLogger(): never {
  throw new Error('Node logger unavailable in Workers');
}
/** Workers use the portable PNG metadata writer. */
export function optimizePng(): never {
  throw new Error('Native PNG unavailable in Workers');
}
/** Workers use the original boundary data through Assets. */
export function nodeTimezone(): never {
  throw new Error('Node timezone unavailable in Workers');
}

/** SQLite native adapter is only available in local Node development. */
export function localAdapter(): never {
  throw new Error('D1 binding required');
}
