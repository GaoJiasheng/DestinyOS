import type { Condition, Evidence, When } from './types';
type Token =
  | { kind: 'property'; key: string }
  | { kind: 'wildcard' }
  | { kind: 'filter'; key: string; value: unknown };
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function parsePath(path: string): Token[] {
  const tokens: Token[] = [];
  let rest = path;
  let needsProperty = true;
  while (rest) {
    if (needsProperty) {
      const match = /^([A-Za-z_][\w]*|\*)/.exec(rest);
      if (!match) throw new Error(`Invalid path: ${path}`);
      const key = match[0];
      tokens.push(key === '*' ? { kind: 'wildcard' } : { kind: 'property', key });
      rest = rest.slice(key.length);
      needsProperty = false;
    } else if (rest.startsWith('.')) {
      rest = rest.slice(1);
      needsProperty = true;
    } else if (rest.startsWith('[')) {
      const match = /^\[(\*|[A-Za-z_]\w*=(?:"[^"\]]*"|'[^'\]]*'|[^\]\s=]+))\]/.exec(rest);
      if (!match) throw new Error(`Invalid path: ${path}`);
      const selector = match[1] ?? '';
      if (selector === '*') tokens.push({ kind: 'wildcard' });
      else {
        const at = selector.indexOf('=');
        const raw = selector.slice(at + 1);
        let value: unknown = raw;
        if (
          raw === 'true' ||
          raw === 'false' ||
          raw === 'null' ||
          /^-?\d+(\.\d+)?$/.test(raw) ||
          raw.startsWith('"')
        )
          value = JSON.parse(raw);
        else if (raw.startsWith("'")) value = raw.slice(1, -1);
        tokens.push({ kind: 'filter', key: selector.slice(0, at), value });
      }
      rest = rest.slice(match[0].length);
    } else throw new Error(`Invalid path: ${path}`);
  }
  if (needsProperty || !tokens.length) throw new Error(`Invalid path: ${path}`);
  return tokens;
}
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (record(a) && record(b))
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]))
    );
  return false;
}
/** Values remain arrays at a terminal property; wildcards use existential matching. */
export function resolvePath(chart: unknown, path: string, shapeOnly = false): unknown[] {
  let values: unknown[] = [chart];
  for (const token of parsePath(path)) {
    values = values.flatMap((value): unknown[] => {
      if (token.kind === 'property') {
        if (token.key === 'length' && (Array.isArray(value) || typeof value === 'string'))
          return [value.length];
        return record(value) && Object.hasOwn(value, token.key) ? [value[token.key]] : [];
      }
      if (token.kind === 'wildcard')
        return Array.isArray(value) ? value : record(value) ? Object.values(value) : [];
      if (!Array.isArray(value)) return [];
      return value.filter(
        (item) =>
          record(item) &&
          Object.hasOwn(item, token.key) &&
          (shapeOnly || equal(item[token.key], token.value)),
      );
    });
  }
  return values;
}
export function conditions(when: When): Condition[] {
  if ('all' in when) return when.all.flatMap(conditions);
  if ('any' in when) return when.any.flatMap(conditions);
  if ('not' in when) return conditions(when.not);
  return [when];
}
export function specificity(when: When): number {
  if ('all' in when) return when.all.length * 3 + when.all.reduce((n, c) => n + specificity(c), 0);
  if ('any' in when) return 0;
  if ('not' in when) return specificity(when.not);
  return 0;
}
export function evaluateWhen(
  chart: unknown,
  when: When,
): { matched: boolean; evidence: Evidence[] } {
  if ('all' in when || 'any' in when) {
    const all = 'all' in when;
    const results = (all ? when.all : when.any).map((c) => evaluateWhen(chart, c));
    const matched = all ? results.every((r) => r.matched) : results.some((r) => r.matched);
    return {
      matched,
      evidence: matched ? results.filter((r) => r.matched).flatMap((r) => r.evidence) : [],
    };
  }
  if ('not' in when) {
    const matched = !evaluateWhen(chart, when.not).matched;
    return {
      matched,
      evidence: matched
        ? conditions(when.not).map((c) => ({ path: c.path, value: resolvePath(chart, c.path) }))
        : [],
    };
  }
  const values = resolvePath(chart, when.path);
  if ('exists' in when) {
    const matched = values.some((v) => v !== null && v !== undefined) === when.exists;
    return {
      matched,
      evidence: matched
        ? [{ path: when.path, value: values.length === 1 ? values[0] : values }]
        : [],
    };
  }
  const hits = values.filter((value) => {
    if ('eq' in when) return equal(value, when.eq);
    if ('in' in when) return when.in.some((item) => equal(value, item));
    if ('gte' in when) return typeof value === 'number' && value >= when.gte;
    if ('lte' in when) return typeof value === 'number' && value <= when.lte;
    if ('contains' in when)
      return Array.isArray(value)
        ? value.some((v) => equal(v, when.contains))
        : typeof value === 'string' &&
            typeof when.contains === 'string' &&
            value.includes(when.contains);
    return false;
  });
  return { matched: hits.length > 0, evidence: hits.map((value) => ({ path: when.path, value })) };
}
