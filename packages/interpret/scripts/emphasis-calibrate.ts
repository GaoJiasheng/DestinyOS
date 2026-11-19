// Re-run the frozen-sample calibration for Zi Wei chart emphasis (proposal §5.1, §6.3, §6.6).
// Usage: pnpm emphasis:calibrate [--n 2000] [--review docs/progress/EMPHASIS-ZIWEI-REVIEW.md]
// Prints distribution statistics and the 20/50/80 cutpoints; --review rewrites the generated
// extreme-chart section of the consultant review document. It never edits scoring.yaml.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { Dim } from '@tianji/content';
import { ziweiScoringRules as rules } from '@tianji/content/scoring/ziwei-rules';
import { ziweiScoringCopy } from '@tianji/content/scoring/ziwei-copy';
import { renderEmphasisBasis } from '../src/emphasis/render';
import { ziweiScoringView, type ZiweiPalaceFacts } from '../src/emphasis/ziwei-view';
import { emphasisStats, sampleCharts, suggestCutpoints, type SampleChart } from './emphasis-sample';
const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
type Calibration = {
  sample: number;
  seed: number;
  years: number[];
  now: string;
  quantiles: number[];
};
const source = parse(
  await readFile(resolve(root, 'packages/content/ziwei/scoring.yaml'), 'utf8'),
) as {
  calibration: Calibration;
  cutpoints: number[];
};
const calibration = source.calibration;
const count = Number(option('--n') ?? calibration.sample);
const started = Date.now();
const { samples, failures } = sampleCharts(count, calibration);
const raws = samples.flatMap((s) => rules.dims.map((d) => s.emphasis.dims[d]?.raw ?? 0));
const suggested = suggestCutpoints(raws, calibration.quantiles);
const frozen = source.cutpoints;
const stats = emphasisStats(samples, rules, frozen);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const zh = ziweiScoringCopy.locales.zh;
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const STEM_KEYS = ['jia', 'yi', 'bing', 'ding', 'wu_stem', 'ji', 'geng', 'xin', 'ren', 'gui'];
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const BRANCH_KEYS = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
];
const ganzhi = (stem: string, branch: string) =>
  `${STEMS[STEM_KEYS.indexOf(stem)] ?? stem}${BRANCHES[BRANCH_KEYS.indexOf(branch)] ?? branch}`;
const label = (dim: Dim) => zh.dims[dim]?.label ?? dim;
const lines: string[] = [
  `样本：N = ${count}（失败 ${failures}），种子 ${calibration.seed}，${calibration.years.join('–')} 年，now = ${calibration.now}，耗时 ${((Date.now() - started) / 1000).toFixed(0)} 秒。`,
  '',
  `四维合并 raw 的 ${calibration.quantiles.map((q) => q * 100).join('/')} 分位切点：建议 [${suggested.join(', ')}]，scoring.yaml 冻结值 [${frozen.join(', ')}]${suggested.join() === frozen.join() ? '（一致）' : '（不一致，需评审后再改 yaml）'}。`,
  '',
  '| 维度 | 均值 | 标准差 | raw = 0 | 最低 | 最高 | 2 档 | 3 档 | 4 档 | 5 档 |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rules.dims.map((d) => {
    const m = stats.moments[d];
    const l = stats.levels[d];
    return `| ${label(d)} | ${m.mean.toFixed(2)} | ${m.sd.toFixed(2)} | ${pct(m.zero)} | ${m.min} | ${m.max} | ${['2', '3', '4', '5'].map((k) => pct(l[k] ?? 0)).join(' | ')} |`;
  }),
  '',
  `四维全同档：${pct(stats.allSame)}；没有任何一维 ≥ 4 档（概览句用「均衡」版本）：${pct(stats.topEmpty)}；钳位率：${pct(stats.clampRate)}。`,
  '',
  `每维依据条数：1 条 ${pct(stats.basisCounts['1'] ?? 0)}，2–3 条 ${pct(stats.basisCounts['2-3'] ?? 0)}，4 条以上 ${pct(stats.basisCounts['4+'] ?? 0)}。`,
  '',
  '维度两两相关系数（raw）：' +
    stats.correlations.map((c) => `${c.pair} ${c.r.toFixed(2)}`).join('，') +
    '。',
  '',
  '| 规则 | 编号 | 命中率（按「盘 × 适用维度」） | 至少命中一维的盘 |',
  '|---|---|---|---|',
  ...stats.hitRates.map(
    (h) => `| \`${h.id}\` | ${h.code} | ${pct(h.instance)} | ${pct(h.chart)} |`,
  ),
];
const statsBlock = lines.join('\n');
console.log(statsBlock);
/** Compact palace excerpt a consultant can check against the chart without reading code. */
function palace(facts: ZiweiPalaceFacts): string {
  const term = (key: string) => zh.terms[key] ?? key;
  const tag = (key: string) => {
    const mutagen = facts.mutagens.find((m) => m.star === key)?.mutagen;
    const brightness = facts.brightnessOf[key];
    const notes = [
      brightness && term(`brightness.${brightness}`),
      mutagen && term(`mutagen.${mutagen}`),
    ].filter(Boolean);
    return `${term(`star.${key}`)}${notes.length ? `（${notes.join('，')}）` : ''}`;
  };
  const majors = facts.majorStars.map((s) => tag(s.key)).join('、') || '空宫';
  const minors = [
    ...facts.lucky,
    ...facts.malefic,
    ...(facts.luCun ? ['lu_cun' as const] : []),
    ...(facts.tianMa ? ['tian_ma' as const] : []),
  ]
    .map(tag)
    .join('、');
  return `${term(`palace.${facts.palace}`)}：${majors}${minors ? `；${minors}` : ''}`;
}
function excerpt(sample: SampleChart, dim: Dim, index: number): string {
  const target = ziweiScoringView(sample.chart, rules.palaceOf)[dim];
  const result = sample.emphasis.dims[dim];
  if (!target || !result) return '';
  const basis = result.basis
    .map((b) => `   - ${b.delta > 0 ? '+' : ''}${b.delta}\u3000${renderEmphasisBasis(b, 'zh')}`)
    .join('\n');
  const { birth } = sample;
  const sum = result.basis.reduce((t, b) => t + b.delta, 0);
  const clamped = sum === result.raw ? '' : `（合计 ${sum}，钳位）`;
  return [
    `${index}. **raw ${result.raw}${clamped}（${result.level} 档）**\u3000${birth.date} ${birth.time} ${birth.city} ${birth.gender === 'male' ? '男' : '女'}，${ganzhi(sample.chart.basics.yearStem, sample.chart.basics.yearBranch)}年`,
    `   - 本宫 ${palace(target.self)}`,
    `   - 对宫 ${palace(target.opposite)}`,
    basis,
  ].join('\n');
}
const review = option('--review');
if (review) {
  const sections: string[] = [];
  for (const dim of rules.dims) {
    const ordered = samples
      .map((s, n) => ({ s, n, raw: s.emphasis.dims[dim]?.raw ?? 0 }))
      .sort((a, b) => b.raw - a.raw || a.n - b.n);
    sections.push(
      `### ${label(dim)} · 最高 10 张`,
      '',
      ordered
        .slice(0, 10)
        .map((o, i) => excerpt(o.s, dim, i + 1))
        .join('\n'),
      '',
      `### ${label(dim)} · 最低 10 张`,
      '',
      ordered
        .slice(-10)
        .reverse()
        .map((o, i) => excerpt(o.s, dim, i + 1))
        .join('\n'),
      '',
    );
  }
  const path = resolve(root, review);
  const text = await readFile(path, 'utf8');
  const start = '<!-- calibration:start -->';
  const end = '<!-- calibration:end -->';
  const [head, rest] = text.split(start);
  const tail = rest?.split(end)[1];
  if (head === undefined || tail === undefined)
    throw new Error(`${review} lacks calibration markers`);
  const body = [
    '## 附录 A · 分布统计（脚本生成）',
    '',
    statsBlock,
    '',
    '## 附录 B · 每维最高与最低各 10 张盘（脚本生成）',
    '',
    '括号里依次是亮度、生年四化；「本宫」后面列出的是主星、六吉、六煞、禄存、天马。',
    '',
    ...sections,
  ].join('\n');
  await writeFile(path, `${head}${start}\n\n${body}\n${end}${tail}`);
  console.log(`Updated ${review}`);
}
