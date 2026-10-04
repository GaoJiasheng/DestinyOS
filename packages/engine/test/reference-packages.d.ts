// MIT packages used only as independent test oracles. The released liuyao package points types at a missing .d.ts.
declare module 'liuyao' {
  export class Hexagram {
    static fromQuaternary(value: string): Hexagram | null;
    readonly binary: string;
    readonly sign: string;
    readonly palace: string;
    readonly generation: number;
    readonly kins: readonly string[];
    readonly host: number;
    readonly guest: number;
    readonly inner: { inner: readonly string[] };
    readonly outer: { outer: readonly string[] };
    toChanged(): Hexagram | null;
  }
  export const SixGodTable: readonly { heavenlyStem: string; gods: readonly string[] }[];
}
declare module 'qimen-dunjia' {
  export function generateChartByDatetime(
    datetime: string,
    options: Record<string, string>,
  ): Map<string, unknown>;
  export function chartToObject(chart: Map<string, unknown>): Record<string, unknown>;
}
