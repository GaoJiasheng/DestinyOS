import { resolvePath } from '@tianji/content';
export {
  SIGNS,
  SIGN_GLYPHS,
  PLANET_GLYPHS,
  wrap,
  wheelPoint,
  spreadLongitudes,
  aspectColor,
} from '@tianji/ui-core';
/** Selection from an evidence path, accepting numeric array paths and body identifiers. */
export function bodyFromEvidence<T extends string>(
  bodies: readonly { key: T }[],
  path?: string,
): T | undefined {
  if (!path) return undefined;
  const index = path.match(/^bodies\.(\d+)(?:\.|$)/)?.[1];
  if (index !== undefined) return bodies[Number(index)]?.key;
  if (path.startsWith('bodies[')) {
    try {
      const matches = resolvePath({ bodies }, path.slice(0, path.indexOf(']') + 1));
      return bodies.find((body) =>
        matches.some(
          (value) =>
            value !== null && typeof value === 'object' && 'key' in value && value.key === body.key,
        ),
      )?.key;
    } catch {
      return undefined;
    }
  }
  return bodies.find((body) => path.split('.').includes(body.key))?.key;
}
/** Resolve numeric UI paths and the knowledge corpus's house-index selectors into zero-based rows. */
export function houseFromEvidence(
  houses: readonly { index: number }[],
  path?: string,
): number | undefined {
  if (!path) return undefined;
  const numeric = path.match(/^houses\.(\d+)(?:\.|$)/)?.[1];
  if (numeric !== undefined) return Number(numeric);
  const number = path.match(/^houses\[index=(\d+)\]/)?.[1];
  if (!number) return undefined;
  const index = houses.findIndex((house) => house.index === Number(number));
  return index < 0 ? undefined : index;
}
