import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { loadContent, root } from '../scripts/load';
import { validateScoring } from '../scripts/scoring';
import { checkScoringOutputs } from '../scripts/scoring-output';
const file = `${root}/ziwei/scoring.yaml`;
const source = await readFile(file, 'utf8');
const content = await loadContent();
type Table = {
  cutpoints: number[];
  groups: Record<string, { cap: number }>;
  rules: {
    id: string;
    measure: Record<string, unknown>;
    copy: Record<string, { zh: string; en: string; advice?: unknown }>;
  }[];
};
/** Validate an edited copy of the reviewed table and return its error messages. */
function errorsAfter(edit: (table: Table) => void): string[] {
  const table = parse(source) as Table;
  edit(table);
  return validateScoring(file, stringify(table), content.glossary).diagnostics.map(
    (d) => d.message,
  );
}
const rule = (table: Table, id: string) => {
  const found = table.rules.find((r) => r.id === id);
  if (!found) throw new Error(id);
  return found;
};
describe('ziwei/scoring.yaml', () => {
  it('validates, compiles to integer eighths and matches the committed generated files', async () => {
    expect(content.diagnostics.filter((d) => d.file === file)).toEqual([]);
    const compiled = content.scoring;
    expect(compiled?.rules.unit).toBe(8);
    expect(compiled?.rules.rules.map((r) => r.id)).toEqual(
      [...(compiled?.rules.rules.map((r) => r.id) ?? [])].sort(),
    );
    expect(compiled?.rules.groups).toEqual({ lucky: { cap: 6 }, malefic: { cap: -6 } });
    expect(compiled?.copy.locales.zh.terms['palace.friends']).toBe('交友宫');
    expect(compiled && (await checkScoringOutputs(compiled))).toEqual([]);
  });
  it('rejects deltas off the 0.125 grid', () => {
    expect(
      errorsAfter((t) => {
        rule(t, 'zw.z5.lu_cun').measure.once = 0.3;
      }),
    ).toContain('Score 0.3 must be a multiple of 0.125');
  });
  it('rejects group caps whose sign disagrees with their members', () => {
    expect(
      errorsAfter((t) => {
        t.groups.lucky = { cap: -0.75 };
      }),
    ).toContain('Group lucky cap sign must match every member delta');
    expect(
      errorsAfter((t) => {
        t.groups.malefic = { cap: 0 };
      }),
    ).toContain('A group cap cannot be zero');
  });
  it('rejects non-increasing cutpoints', () => {
    expect(
      errorsAfter((t) => {
        t.cutpoints = [0, 0.75, 0.75];
      }),
    ).toContain('Cutpoints must be strictly increasing');
  });
  it('requires zh/en copy for every possible sign with the same placeholders', () => {
    expect(
      errorsAfter((t) => {
        delete rule(t, 'zw.z1.brightness').copy.zero;
      }),
    ).toContain('Missing zero copy');
    expect(
      errorsAfter((t) => {
        rule(t, 'zw.z3.lu').copy.positive!.en = 'Lu lands in your {palace}.';
      }),
    ).toContain('zh and en templates must use the same placeholders');
    expect(
      errorsAfter((t) => {
        rule(t, 'zw.z4.lucky').copy.positive!.zh = '{opposite}有{stars}同宫。';
        rule(t, 'zw.z4.lucky').copy.positive!.en = '{opposite} holds {stars}.';
      }),
    ).toContain('Placeholder {opposite} is not available for this rule');
    expect(
      errorsAfter((t) => {
        delete rule(t, 'zw.z3.ji').copy.negative!.advice;
      }).some((m) => m.includes('advice')),
    ).toBe(true);
  });
  it('rejects banned promises and half-width Chinese punctuation', () => {
    expect(
      errorsAfter((t) => {
        rule(t, 'zw.z5.lu_cun').copy.positive!.zh = '禄存在{palace}，保证能积累。';
      }),
    ).toContain('Banned emphasis phrase: 保证');
    expect(
      errorsAfter((t) => {
        rule(t, 'zw.z5.lu_cun').copy.positive!.en = 'Lu Cun in your {palace} is guaranteed wealth.';
      }),
    ).toContain('Banned emphasis phrase: guaranteed');
    expect(
      errorsAfter((t) => {
        rule(t, 'zw.z5.lu_cun').copy.positive!.zh = '禄存在{palace}, 传统上代表稳定。';
      }),
    ).toContain('Chinese emphasis copy must use full-width punctuation');
  });
});
