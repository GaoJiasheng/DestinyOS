// Prototype of the layered Bazi use-god rules (docs/progress/BAZI-USEGOD-PROPOSAL-2026-11-22.md)
// compared with the engine's current output on the frozen sample of SCORING-PROPOSAL §6.1.
// Usage (repository root): npx tsx packages/content/scripts/bazi-usegod-stats.ts [--n 2000]
// Read-only: it never edits the engine, fixtures or content. The rough career/wealth/love
// projection below only measures how much the three dimensions differ; it is not a product rule.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BirthInputSchema, type BaziChart, type Element } from '@tianji/shared';
import { computeBazi, normalizeBirth, ELEMENTS, STEM_ELEMENTS } from '../../engine/src';

type Role = 'yong' | 'xi' | 'ji' | 'chou' | 'xian';
type Group = 'peer' | 'output' | 'wealth' | 'officer' | 'resource';
type Basis = 'tiao_hou_urgent' | 'tong_guan' | 'tiao_hou' | 'fu_yi' | 'fu_yi_lean' | 'balance_even';
export type UseGodV2 = {
  yongShen: Element | null;
  basis: Basis;
  roles: Partial<Record<Element, Role>>;
  reasons: Partial<Record<Element, string>>;
  favorable: Element[];
  unfavorable: Element[];
  flags: string[];
};
const GROUPS: Group[] = ['peer', 'output', 'wealth', 'officer', 'resource'];
/** k steps along the generating cycle wood→fire→earth→metal→water. */
const step = (e: Element, k: number) => ELEMENTS[(((ELEMENTS.indexOf(e) + k) % 5) + 5) % 5]!;
const elementOf = (dm: Element, g: Group) => step(dm, GROUPS.indexOf(g));
const groupOf = (dm: Element, e: Element) =>
  GROUPS[(ELEMENTS.indexOf(e) - ELEMENTS.indexOf(dm) + 5) % 5]!;
/** Same-side alternative when the chosen 用神 is absent from the chart. */
const ALT = Object.fromEntries(
  GROUPS.map((g, i) => [g, (['resource', 'wealth', 'output', 'output', 'peer'] as const)[i]]),
) as Record<Group, Group>;
const WINTER = ['hai', 'zi', 'chou'];
const SUMMER = ['si', 'wu', 'wei'];

/** Layered rules: urgent climate > mediation > agreeing mild climate > support/restraint (by the
 * disease) > conflicting mild climate as a secondary 喜. `lean` lets |score| ≥ 1.25 balanced charts
 * use the support/restraint side they lean to (owner question Q3). */
export function selectUseGodV2(chart: BaziChart, opts: { lean?: boolean } = {}): UseGodV2 {
  const dm = chart.dayMaster.element;
  const { raw, pct } = chart.elements;
  const { score } = chart.strength;
  const leaning = chart.strength.level === 'balanced' && opts.lean && Math.abs(score) >= 1.25;
  const level = leaning ? (score > 0 ? 'strong' : 'weak') : chart.strength.level;
  const el = (g: Group) => elementOf(dm, g);
  // Weight of a group; the day stem itself is not counted as a peer.
  const w = (g: Group) => raw[el(g)] - (g === 'peer' ? 1 : 0);
  const flags: string[] = [];
  // 1. Climate (调候): winter needs fire, summer needs water; urgent when only residual qi or none.
  const month = chart.pillars.month.branch;
  const need: Element | undefined =
    WINTER.includes(month) && pct.fire < 10
      ? 'fire'
      : SUMMER.includes(month) && pct.water < 10
        ? 'water'
        : undefined;
  const urgent = need !== undefined && pct[need] < 5;
  // 2. Mediation (通关): A controls B, both ≥25%, ratio ≥0.6, the element between them <15%.
  let battle: { a: Element; b: Element; m: Element } | undefined;
  for (const a of ELEMENTS) {
    const b = step(a, 2),
      m = step(a, 1);
    const [lo, hi] = [Math.min(pct[a], pct[b]), Math.max(pct[a], pct[b])];
    if (lo >= 25 && lo / hi >= 0.6 && pct[m] < 15)
      if (!battle || pct[a] + pct[b] > pct[battle.a] + pct[battle.b]) battle = { a, b, m };
  }
  // 3. Support/restraint (扶抑) chooses by the heaviest opposing group (the disease).
  let fuyi: { g: Group; key: string; disease: Group } | undefined;
  if (level === 'weak') {
    const disease = (['officer', 'wealth', 'output'] as Group[]).reduce((x, y) =>
      w(y) > w(x) ? y : x,
    );
    fuyi =
      disease === 'officer'
        ? { g: 'resource', key: 'sha_zhong_yong_yin', disease }
        : disease === 'wealth'
          ? { g: 'peer', key: 'cai_duo_yong_bi', disease }
          : { g: 'resource', key: 'shang_zhong_yong_yin', disease };
  } else if (level === 'strong') {
    fuyi =
      w('resource') > w('peer')
        ? { g: 'wealth', key: 'yin_zhong_yong_cai', disease: 'resource' }
        : w('officer') >= 1
          ? { g: 'officer', key: 'bi_zhong_yong_guan', disease: 'peer' }
          : { g: 'output', key: 'bi_zhong_yong_shi', disease: 'peer' };
  }
  if (fuyi && w(fuyi.g) <= 0) {
    // The chosen element is absent: take the same-side alternative if the chart has it.
    const alt = ALT[fuyi.g];
    if (w(alt) > 0) {
      fuyi = { ...fuyi, g: alt, key: `${fuyi.key}_fallback` };
      flags.push('fallback');
    } else flags.push('yong_absent');
  }
  const sameSide = (e: Element) =>
    level === 'weak'
      ? ['peer', 'resource'].includes(groupOf(dm, e))
      : !['peer', 'resource'].includes(groupOf(dm, e));
  let yong: Element | null = null;
  let basis: Basis = 'balance_even';
  let yongKey = '';
  const balanced = level === 'balanced';
  if (urgent && need) [yong, basis, yongKey] = [need, 'tiao_hou_urgent', `tiao_hou_${need}`];
  else if (balanced && need) [yong, basis, yongKey] = [need, 'tiao_hou', `tiao_hou_${need}`];
  else if (battle && (balanced || sameSide(battle.m)))
    [yong, basis, yongKey] = [battle.m, 'tong_guan', 'tong_guan'];
  else if (need && sameSide(need)) [yong, basis, yongKey] = [need, 'tiao_hou', `tiao_hou_${need}`];
  else if (fuyi) [yong, basis, yongKey] = [el(fuyi.g), leaning ? 'fu_yi_lean' : 'fu_yi', fuyi.key];
  const roles: Partial<Record<Element, Role>> = {};
  const reasons: Partial<Record<Element, string>> = {};
  const set = (e: Element, role: Role, key: string) => {
    roles[e] = role;
    reasons[e] = `bazi.usegod.${role}.${key}`;
  };
  if (yong) {
    // Default cycle: 喜 generates 用, 忌 controls 用, 仇 generates 忌, 闲 is what 用 generates.
    set(yong, 'yong', yongKey);
    set(step(yong, -1), 'xi', 'sheng_yong');
    set(step(yong, 3), 'ji', 'ke_yong');
    set(step(yong, 2), 'chou', 'sheng_ji');
    set(step(yong, 1), 'xian', 'default');
    const yg = groupOf(dm, yong);
    if (level === 'weak' && yg === 'resource') {
      // 身弱用印: 比劫帮身为喜; 官杀不再列喜（克身），本身是病时列忌。
      set(el('peer'), 'xi', 'bang_shen');
      if (fuyi?.disease === 'officer' && basis.startsWith('fu_yi'))
        set(el('officer'), 'ji', 'bing');
      else set(el('officer'), 'xian', 'ke_shen');
    }
    if (level === 'strong' && yg === 'output') {
      // 身强用食伤: 财为喜（泄秀生财）; 比劫是病，列仇。
      set(el('wealth'), 'xi', 'xie_xiu_sheng_cai');
      set(el('peer'), 'chou', 'bing');
      set(el('officer'), 'xian', 'default');
    }
    // 4. Mild climate becomes a secondary 喜, or at least stops being 忌/仇.
    if (need && !urgent && yong !== need) {
      const r = roles[need];
      if (r === 'ji' || r === 'chou') set(need, 'xian', 'tiao_hou_neutral');
      else if (r === 'xian') set(need, 'xi', 'tiao_hou');
    }
    // 5. Disease and remedy (病药): 忌 overwhelms a thin 用 → what controls 忌 becomes 喜.
    const ji = step(yong, 3);
    if (roles[ji] === 'ji' && pct[ji] >= 30 && pct[yong] <= 10 && roles[step(yong, 1)] === 'xian') {
      set(step(yong, 1), 'xi', 'bing_yao');
      flags.push('bing_yao');
    }
    // 6. Direction guards: a weak chart never lists its own support as 忌/仇, a strong one never as 喜.
    for (const g of ['peer', 'resource'] as Group[]) {
      const e = el(g);
      if (e === yong) continue;
      if (level === 'weak' && (roles[e] === 'ji' || roles[e] === 'chou')) {
        set(e, 'xian', 'fu_yi_deferred');
        flags.push('guard');
      }
      if (level === 'strong' && roles[e] === 'xi') {
        set(e, 'xian', 'fu_yi_deferred');
        flags.push('guard');
      }
    }
  }
  if (chart.pattern.notes.includes('bazi.rules.suspected_cong')) flags.push('suspected_cong');
  if (chart.strength.score >= 8 && w('officer') === 0) flags.push('suspected_zhuan_wang');
  const pick = (...rs: Role[]) => ELEMENTS.filter((e) => rs.includes(roles[e] as Role));
  return {
    yongShen: yong,
    basis,
    roles,
    reasons,
    favorable: yong ? [yong, ...pick('xi')] : [],
    unfavorable: pick('ji', 'chou'),
    flags,
  };
}

/** The rule before engine 0.4.1 (what SCORING-PROPOSAL §6.2 measured). */
function legacyV0(chart: BaziChart) {
  const { group, tiaoHou, favorable } = chart.useGod;
  if (group !== 'balance') return { favorable, unfavorable: chart.useGod.unfavorable };
  const fav = tiaoHou ? [tiaoHou] : [...ELEMENTS];
  return { favorable: fav, unfavorable: ELEMENTS.filter((e) => !fav.includes(e)) };
}

const CITIES = {
  beijing: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  guangzhou: { name: 'Guangzhou', lat: 23.13, lng: 113.26, tz: 'Asia/Shanghai' },
  taipei: { name: 'Taipei', lat: 25.03, lng: 121.56, tz: 'Asia/Taipei' },
  hong_kong: { name: 'Hong Kong', lat: 22.32, lng: 114.17, tz: 'Asia/Hong_Kong' },
  new_york: { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
  vancouver: { name: 'Vancouver', lat: 49.28, lng: -123.12, tz: 'America/Vancouver' },
  sydney: { name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
  london: { name: 'London', lat: 51.51, lng: -0.13, tz: 'Europe/London' },
} as const;
const NOW = '2026-11-16T00:00:00Z';
/** mulberry32, same five draws per birth as packages/interpret/scripts/emphasis-sample.ts. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Sample = { chart: BaziChart; gender: 'male' | 'female' };
function sample(count: number): { samples: Sample[]; failures: number } {
  const next = random(20261116);
  const start = Date.UTC(1950, 0, 1);
  const days = Math.round((Date.UTC(2006, 0, 1) - start) / 86400000);
  const cities = Object.values(CITIES);
  const samples: Sample[] = [];
  let failures = 0;
  for (let n = 0; n < count; n++) {
    const day = new Date(start + Math.floor(next() * days) * 86400000);
    const [hour, minute] = [Math.floor(next() * 24), Math.floor(next() * 60)];
    const place = cities[Math.floor(next() * cities.length)]!;
    const gender = next() < 0.5 ? 'male' : 'female';
    try {
      const birth = BirthInputSchema.parse({
        calendar: 'gregorian',
        year: day.getUTCFullYear(),
        month: day.getUTCMonth() + 1,
        day: day.getUTCDate(),
        hour,
        minute,
        timeUnknown: false,
        place,
        gender,
      });
      samples.push({ chart: computeBazi(normalizeBirth(birth), { now: NOW }), gender });
    } catch {
      failures++;
    }
  }
  return { samples, failures };
}

type Sets = { favorable: Element[]; unfavorable: Element[] };
type Dim = 'career' | 'wealth' | 'love';
const valence = (s: Sets, e: Element) =>
  s.favorable.includes(e) ? 1 : s.unfavorable.includes(e) ? -1 : 0;
const pctOf = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
function pearson(x: number[], y: number[]) {
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const [mx, my] = [mean(x), mean(y)];
  let [sxy, sxx, syy] = [0, 0, 0];
  x.forEach((xi, i) => {
    const [dx, dy] = [xi - mx, y[i]! - my];
    [sxy, sxx, syy] = [sxy + dx * dy, sxx + dx * dx, syy + dy * dy];
  });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}
/** Rough projection: valence × presence (0.5–1.5) of 官杀, 财 and the spouse star plus day branch. */
function dims(s: Sample, sets: Sets) {
  const { chart } = s;
  const dm = chart.dayMaster.element;
  const presence = (g: Group) =>
    0.5 + Math.min(chart.elements.raw[elementOf(dm, g)] - (g === 'peer' ? 1 : 0), 4) / 4;
  const of = (g: Group) => valence(sets, elementOf(dm, g)) * presence(g);
  const spouse: Group = s.gender === 'male' ? 'wealth' : 'officer';
  const dayElement = STEM_ELEMENTS[chart.pillars.day.hiddenStems[0]!.stem];
  const love = of(spouse) + 0.5 * valence(sets, dayElement);
  return { career: of('officer'), wealth: of('wealth'), love };
}
function countBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  items.forEach((t) => m.set(key(t), (m.get(key(t)) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function report(name: string, samples: Sample[], sets: Sets[]) {
  const n = samples.length;
  console.log(`\n### ${name}`);
  const shape = countBy(sets, (s) => `${s.favorable.length} 喜 ${s.unfavorable.length} 忌`);
  console.log(`喜/忌个数：${shape.map(([k, v]) => `${k} ${pctOf(v, n)}`).join(' · ')}`);
  const ow = samples.map((s, i) =>
    (['officer', 'wealth'] as Group[]).map((g) =>
      valence(sets[i]!, elementOf(s.chart.dayMaster.element, g)),
    ),
  );
  const same = ow.filter(([o, w]) => o === w && o !== 0).length;
  const bothZero = ow.filter(([o, w]) => o === 0 && w === 0).length;
  console.log(`官杀、财星同喜或同忌：${pctOf(same, n)}；两者都不喜不忌：${pctOf(bothZero, n)}`);
  for (const level of ['strong', 'balanced', 'weak'] as const) {
    const idx = samples.flatMap((s, i) => (s.chart.strength.level === level ? [i] : []));
    const tally = (g: Group, v: number) =>
      idx.filter((i) => valence(sets[i]!, elementOf(samples[i]!.chart.dayMaster.element, g)) === v)
        .length;
    console.log(
      `  ${level}（${idx.length}）官杀 喜/忌/闲 ${pctOf(tally('officer', 1), idx.length)} / ${pctOf(tally('officer', -1), idx.length)} / ${pctOf(tally('officer', 0), idx.length)}；` +
        `财 ${pctOf(tally('wealth', 1), idx.length)} / ${pctOf(tally('wealth', -1), idx.length)} / ${pctOf(tally('wealth', 0), idx.length)}`,
    );
  }
  const d = samples.map((s, i) => dims(s, sets[i]!));
  const col = (k: Dim, pick?: (s: Sample) => boolean) =>
    d.filter((_, i) => !pick || pick(samples[i]!)).map((x) => x[k]);
  const r = (a: Dim, b: Dim) => pearson(col(a), col(b)).toFixed(2);
  console.log(
    `相关系数 事业–财富 ${r('career', 'wealth')} · 事业–感情 ${r('career', 'love')} · 财富–感情 ${r('wealth', 'love')}`,
  );
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
  const by = (k: Dim, level: string) => mean(col(k, (s) => s.chart.strength.level === level));
  const gap = (k: Dim) => (by(k, 'strong') - by(k, 'weak')).toFixed(2);
  console.log(
    `身强组均值 − 身弱组均值：事业 ${gap('career')} · 财富 ${gap('wealth')} · 感情 ${gap('love')}（取值约 −2..+2）`,
  );
}

const zip = (keys: string, values: string[]) =>
  Object.fromEntries(keys.split(' ').map((k, i) => [k, values[i]!])) as Record<string, string>;
const LABEL = {
  ...zip('wood fire earth metal water yong xi ji chou xian', [...'木火土金水用喜忌仇闲']),
  ...zip('peer output wealth officer resource', ['比劫', '食伤', '财', '官杀', '印']),
};
const HANZI = zip(
  'jia yi bing ding wu_stem ji geng xin ren gui zi chou yin mao chen si wu wei shen you xu hai',
  [...'甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'],
);
const list = (es: Element[]) => es.map((e) => LABEL[e]).join('') || '—';
const tally = (items: string[], d: number) =>
  countBy(items, (k) => k)
    .map(([k, v]) => `${k} ${pctOf(v, d)}`)
    .join(' · ');
function fixtures() {
  const out = ['\n## Fixture 新旧对照'];
  const dir = join(import.meta.dirname, '../../engine/test/fixtures/bazi');
  for (const name of ['A', 'B', 'C', 'D', 'E', 'G']) {
    const f = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')) as { input: unknown };
    const chart = computeBazi(normalizeBirth(BirthInputSchema.parse(f.input)), { now: NOW });
    const [u, p, dm] = [selectUseGodV2(chart), chart.pillars, chart.dayMaster.element];
    const four = [p.year, p.month, p.day, p.hour].map((x) =>
      x ? HANZI[x.stem]! + HANZI[x.branch]! : '——',
    );
    out.push(
      `\n${name}: ${four.join(' ')} 日主${LABEL[dm]} ${chart.strength.level} ${chart.strength.score}`,
      `  五行% ${ELEMENTS.map((e) => LABEL[e] + chart.elements.pct[e].toFixed(1)).join(' ')}`,
      `  旧：喜 ${list(chart.useGod.favorable)} 忌 ${list(chart.useGod.unfavorable)} ${chart.useGod.rationale}`,
      `  新：用神 ${u.yongShen ? LABEL[u.yongShen] : '无'} 依据 ${u.basis} ${u.flags}`,
      `      ${ELEMENTS.map((e) => `${LABEL[e]}(${LABEL[groupOf(dm, e)]})=${LABEL[u.roles[e] ?? ''] ?? '—'}`).join(' ')}`,
      `      喜 ${list(u.favorable)} 忌 ${list(u.unfavorable)}`,
      `      ${ELEMENTS.flatMap((e) => u.reasons[e] ?? []).join(' ')}`,
    );
  }
  console.log(out.join('\n'));
}

const at = process.argv.indexOf('--n');
const count = at > 0 ? Number(process.argv[at + 1]) : 2000;
const started = Date.now();
const { samples, failures } = sample(count);
const n = samples.length;
console.log(
  `# 八字用神新旧对比（样本 ${n}，失败 ${failures}，种子 20261116，${(Date.now() - started) / 1000}s）`,
);
const levels = countBy(samples, (s) => s.chart.strength.level);
console.log(`身强弱：${levels.map(([k, v]) => `${k} ${pctOf(v, n)}`).join(' · ')}`);
const v2 = samples.map((s) => selectUseGodV2(s.chart));
const variants: [string, Sets[]][] = [
  ['v0（0.4.1 之前：中和全喜）', samples.map((s) => legacyV0(s.chart))],
  ['v1（现行引擎 0.4.1）', samples.map((s) => s.chart.useGod)],
  ['v2（本方案原型）', v2],
  ['v2 + 中和偏向（Q3 备选）', samples.map((s) => selectUseGodV2(s.chart, { lean: true }))],
];
variants.forEach(([name, sets]) => report(name, samples, sets));
console.log('\n### v2 用神依据与分组');
console.log(
  tally(
    v2.map((u) => u.basis),
    n,
  ),
);
for (const level of ['strong', 'balanced', 'weak'] as const) {
  const idx = samples.flatMap((s, i) => (s.chart.strength.level === level ? [i] : []));
  const yong = idx.map((i) => {
    const y = v2[i]!.yongShen;
    return y ? LABEL[groupOf(samples[i]!.chart.dayMaster.element, y)]! : '无';
  });
  console.log(`  ${level}（${idx.length}）用神：${tally(yong, idx.length)}`);
}
console.log(
  `规则触发：${tally(
    v2.flatMap((u) => [...new Set(u.flags)]),
    n,
  )}`,
);
const roleOf = (u: UseGodV2, dm: Element, g: Group) =>
  LABEL[u.roles[elementOf(dm, g)] ?? ''] ?? '—';
const pairs = samples.map((s, i) => {
  const dm = s.chart.dayMaster.element;
  return `官杀${roleOf(v2[i]!, dm, 'officer')}/财${roleOf(v2[i]!, dm, 'wealth')}`;
});
console.log(`官杀/财角色组合：${tally(pairs, n)}`);
const first = samples.filter((s, i) => s.chart.useGod.favorable[0] !== v2[i]!.favorable[0]).length;
console.log(`favorable[0]（每日幸运色依据）变化：${pctOf(first, n)}`);
const flips = samples.flatMap((s, i) =>
  ELEMENTS.filter((e) => valence(s.chart.useGod, e) !== valence(v2[i]!, e)),
).length;
console.log(`五行喜忌标记变化：${pctOf(flips, n * 5)}（≈ 每日运势喜忌命中改变的日子比例）`);
fixtures();
