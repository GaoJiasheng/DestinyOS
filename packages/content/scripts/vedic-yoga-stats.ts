// Hit rates of the Vedic yoga tightening options in docs/progress/VEDIC-YOGA-PROPOSAL-2026-11-22.md.
// Usage: pnpm exec tsx packages/content/scripts/vedic-yoga-stats.ts [--n 2000] [--no-noon]
// Read-only: it calls the engine as it stands and evaluates every option here, never in the engine.
// Sample (SCORING-PROPOSAL-2026-11-16 §6.1): seed 20261116, births uniform over 1950–2005 with a
// random clock, one of eight cities, now = 2026-11-16. Each draw consumes five random numbers
// (date, hour, minute, city, gender) in the order of packages/interpret/scripts/emphasis-sample.ts.
import { BirthInputSchema, type Graha, type VedicChart } from '@tianji/shared';
import { computeVedic, normalizeBirth, ENGINE_VERSION, SIGNS, VEDIC_LORDS } from '../../engine/src';

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const COUNT = Number(option('--n') ?? 2000);
const WITH_NOON = !args.includes('--no-noon');
const SEED = 20261116;
const NOW = '2026-11-16T00:00:00Z';
const CITIES = [
  { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  { name: 'Guangzhou', lat: 23.13, lng: 113.26, tz: 'Asia/Shanghai' },
  { name: 'Taipei', lat: 25.03, lng: 121.56, tz: 'Asia/Taipei' },
  { name: 'Hong Kong', lat: 22.32, lng: 114.17, tz: 'Asia/Hong_Kong' },
  { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
  { name: 'Vancouver', lat: 49.28, lng: -123.12, tz: 'America/Vancouver' },
  { name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
  { name: 'London', lat: 51.51, lng: -0.13, tz: 'Europe/London' },
];

/** mulberry32, identical to the emphasis calibration sampler. */
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

type Body = VedicChart['bodies'][number];
type Pair = { a: Body; b: Body; lords: [number, number] };
type Facts = {
  chart: VedicChart;
  get: (key: Graha) => Body;
  lagnaIndex: number | null;
};

// ---------- shared helpers ----------
const signIndex = (body: Body) => SIGNS.indexOf(body.sign);
/** Sign of `a` counted from `b`, 1..12 (whole-sign, as the engine counts). */
const rel = (a: Body, b: Body) => ((signIndex(a) - signIndex(b) + 12) % 12) + 1;
const KENDRA = [1, 4, 7, 10];
const DUSTHANA = [6, 8, 12];
const GOOD_HOUSE = [1, 4, 5, 7, 9, 10];
const STRONG = ['exalted', 'own', 'moolatrikona'];
const separation = (a: Body, b: Body) => {
  const d = Math.abs(a.sidLon - b.sidLon) % 360;
  return d > 180 ? 360 - d : d;
};
/** House condition: skipped (passes) on a noon chart, the way Kemadruma skips the Lagna cancellation. */
const houseOk = (body: Body, allowed: (house: number) => boolean) =>
  body.house === null || allowed(body.house);
/** Parashari sign aspects: every graha the 7th; Mars also 4/8, Jupiter 5/9, Saturn 3/10; nodes none. */
const SPECIAL: Partial<Record<Graha, number[]>> = {
  mangala: [4, 8],
  guru: [5, 9],
  shani: [3, 10],
};
const aspects = (from: Body, to: Body) =>
  from.key !== 'rahu' &&
  from.key !== 'ketu' &&
  [7, ...(SPECIAL[from.key] ?? [])].includes(rel(to, from));
const unafflicted = (body: Body) => body.dignity !== 'debilitated' && !body.combust;
/** Houses ruled by a planet for this Lagna (whole sign). */
const owned = (facts: Facts, planet: Graha) =>
  facts.lagnaIndex === null
    ? []
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(
        (h) => VEDIC_LORDS[(facts.lagnaIndex! + h - 1) % 12] === planet,
      );

/** Every distinct-lord same-sign pair the engine's `conjoined` would consider, not only the first. */
function pairs(facts: Facts, first: number[], second: number[]): Pair[] {
  if (facts.lagnaIndex === null) return [];
  const lord = (h: number) => facts.get(VEDIC_LORDS[(facts.lagnaIndex! + h - 1) % 12]!);
  const out: Pair[] = [];
  for (const h1 of first)
    for (const h2 of second) {
      const a = lord(h1),
        b = lord(h2);
      if (a.key !== b.key && a.sign === b.sign) out.push({ a, b, lords: [h1, h2] });
    }
  return out;
}

// ---------- option predicates ----------
type Option = { id: string; label: string; test: (f: Facts) => boolean };

const moonSun = (f: Facts) => separation(f.get('chandra'), f.get('surya'));
const jupiterInKendraFromMoon = (f: Facts) => KENDRA.includes(rel(f.get('guru'), f.get('chandra')));
const jupiterStrong = (f: Facts) => {
  const j = f.get('guru');
  return j.dignity !== 'debilitated' && j.dignity !== 'enemy' && !j.combust;
};
const moonStrong = (f: Facts) => f.get('chandra').dignity !== 'debilitated' && moonSun(f) >= 72;
const jupiterWithBenefic = (f: Facts) => {
  const j = f.get('guru');
  return (['budha', 'shukra'] as Graha[]).some((k) => {
    const b = f.get(k);
    return b.sign === j.sign || aspects(b, j);
  });
};

const sameSignSunMercury = (f: Facts) => f.get('surya').sign === f.get('budha').sign;
const mercuryClear = (f: Facts) => !f.get('budha').combust;
const mercuryPlaced = (f: Facts) => {
  const m = f.get('budha');
  return (
    m.dignity !== 'debilitated' &&
    f.get('surya').dignity !== 'debilitated' &&
    houseOk(m, (h) => !DUSTHANA.includes(h))
  );
};
const mercuryAngular = (f: Facts) => houseOk(f.get('budha'), (h) => GOOD_HOUSE.includes(h));

const pairClean = (p: Pair) =>
  unafflicted(p.a) && unafflicted(p.b) && houseOk(p.a, (h) => !DUSTHANA.includes(h));
const pairClose = (p: Pair) => separation(p.a, p.b) <= 10;
const pairDignified = (p: Pair) => STRONG.includes(p.a.dignity) || STRONG.includes(p.b.dignity);
/** BPHS: lords that also rule the 8th or 11th do not form the yoga by mere association (Lagna lord exempt). */
const pairNoMaraka = (f: Facts) => (p: Pair) =>
  [p.a, p.b].every(
    (body) =>
      owned(f, body.key).includes(1) || !owned(f, body.key).some((h) => h === 8 || h === 11),
  );

const RAJA: [number[], number[]] = [
  [1, 4, 7, 10],
  [5, 9],
];
const DHANA: [number[], number[]] = [
  [2, 11],
  [5, 9],
];
const anyPair = (houses: [number[], number[]], ...accept: ((p: Pair, f: Facts) => boolean)[]) =>
  ((f: Facts) => pairs(f, ...houses).some((p) => accept.every((t) => t(p, f)))) as (
    f: Facts,
  ) => boolean;

const all =
  (...tests: ((f: Facts) => boolean)[]) =>
  (f: Facts) =>
    tests.every((t) => t(f));

const OPTIONS: Record<string, Option[]> = {
  gajakesari: [
    { id: 'G0', label: '现行：木星在月亮起算的 1/4/7/10', test: jupiterInKendraFromMoon },
    {
      id: 'G1',
      label: 'G0 + 木星不落陷、不入敌宫、不焦伤',
      test: all(jupiterInKendraFromMoon, jupiterStrong),
    },
    {
      id: 'G2',
      label: 'G0 + 月亮不落陷、离太阳 ≥ 72°',
      test: all(jupiterInKendraFromMoon, moonStrong),
    },
    {
      id: 'G3',
      label: 'G1 + 水星或金星与木星同座或相照',
      test: all(jupiterInKendraFromMoon, jupiterStrong, jupiterWithBenefic),
    },
    {
      id: 'G1+G2',
      label: '木星有力且月亮有力',
      test: all(jupiterInKendraFromMoon, jupiterStrong, moonStrong),
    },
    {
      id: 'G1+G2+宫',
      label: 'G1+G2，且木星不在 6/8/12 宫',
      test: all(jupiterInKendraFromMoon, jupiterStrong, moonStrong, (f) =>
        houseOk(f.get('guru'), (h) => !DUSTHANA.includes(h)),
      ),
    },
  ],
  budha_aditya: [
    { id: 'B0', label: '现行：日水同座', test: sameSignSunMercury },
    { id: 'B1', label: 'B0 + 水星不焦伤', test: all(sameSignSunMercury, mercuryClear) },
    {
      id: 'B2',
      label: 'B0 + 日水都不落陷，水星不在 6/8/12 宫',
      test: all(sameSignSunMercury, mercuryPlaced),
    },
    {
      id: 'B3',
      label: 'B0 + 水星在 1/4/5/7/9/10 宫',
      test: all(sameSignSunMercury, mercuryAngular),
    },
    {
      id: 'B1+B2',
      label: '不焦伤 + 不落陷 + 不在凶宫',
      test: all(sameSignSunMercury, mercuryClear, mercuryPlaced),
    },
    {
      id: 'B1+B3',
      label: '不焦伤 + 角宫或三方宫',
      test: all(sameSignSunMercury, mercuryClear, mercuryAngular),
    },
  ],
  raja_yoga: [
    { id: 'R0', label: '现行：角宫主与三方宫主同座', test: anyPair(RAJA) },
    { id: 'R1', label: 'R0 + 两主星不落陷不焦伤、不在 6/8/12', test: anyPair(RAJA, pairClean) },
    { id: 'R2', label: 'R0 + 两主星相距 ≤ 10°', test: anyPair(RAJA, pairClose) },
    { id: 'R3', label: 'R0 + 至少一颗入旺/自宫/本垣三方', test: anyPair(RAJA, pairDignified) },
    {
      id: 'R4',
      label: 'R0 + 排除兼管 8/11 宫的主星（命主除外）',
      test: (f) => anyPair(RAJA, pairNoMaraka(f))(f),
    },
    { id: 'R1+R2', label: '不受损 + ≤ 10°', test: anyPair(RAJA, pairClean, pairClose) },
    { id: 'R1+R3', label: '不受损 + 有尊贵', test: anyPair(RAJA, pairClean, pairDignified) },
    {
      id: 'R1+R4',
      label: '不受损 + 排除 8/11 宫主',
      test: (f) => anyPair(RAJA, pairClean, pairNoMaraka(f))(f),
    },
  ],
  dhana_yoga: [
    { id: 'D0', label: '现行：2/11 宫主与 5/9 宫主同座', test: anyPair(DHANA) },
    { id: 'D1', label: 'D0 + 两主星不落陷不焦伤、不在 6/8/12', test: anyPair(DHANA, pairClean) },
    { id: 'D2', label: 'D0 + 两主星相距 ≤ 10°', test: anyPair(DHANA, pairClose) },
    { id: 'D3', label: 'D0 + 至少一颗入旺/自宫/本垣三方', test: anyPair(DHANA, pairDignified) },
    { id: 'D1+D2', label: '不受损 + ≤ 10°', test: anyPair(DHANA, pairClean, pairClose) },
    { id: 'D1+D3', label: '不受损 + 有尊贵', test: anyPair(DHANA, pairClean, pairDignified) },
  ],
};

// ---------- sampling ----------
function sample(): { timed: Facts[]; noon: Facts[]; failures: number } {
  const next = random(SEED);
  const start = Date.UTC(1950, 0, 1);
  const days = Math.round((Date.UTC(2006, 0, 1) - start) / 86400000);
  const timed: Facts[] = [],
    noon: Facts[] = [];
  let failures = 0;
  const facts = (chart: VedicChart): Facts => ({
    chart,
    get: (key) => chart.bodies.find((b) => b.key === key)!,
    lagnaIndex: chart.lagna ? SIGNS.indexOf(chart.lagna.sign) : null,
  });
  for (let n = 0; n < COUNT; n++) {
    const day = new Date(start + Math.floor(next() * days) * 86400000);
    const hour = Math.floor(next() * 24);
    const minute = Math.floor(next() * 60);
    const place = CITIES[Math.floor(next() * CITIES.length)] ?? CITIES[0]!;
    const gender = next() < 0.5 ? 'male' : 'female';
    const input = (timeUnknown: boolean) =>
      normalizeBirth(
        BirthInputSchema.parse({
          calendar: 'gregorian',
          year: day.getUTCFullYear(),
          month: day.getUTCMonth() + 1,
          day: day.getUTCDate(),
          hour,
          minute,
          timeUnknown,
          place,
          gender,
        }),
      );
    try {
      timed.push(facts(computeVedic(input(false), NOW)));
      if (WITH_NOON) noon.push(facts(computeVedic(input(true), NOW)));
    } catch {
      failures++;
    }
  }
  return { timed, noon, failures };
}

// ---------- report ----------
const started = Date.now();
const { timed, noon, failures } = sample();
const pct = (k: number, n: number) => (n ? `${((k / n) * 100).toFixed(1)}%` : '—');
const rate = (set: Facts[], test: (f: Facts) => boolean) => set.filter(test).length;
const lines: string[] = [
  `引擎 ${ENGINE_VERSION}；样本 N = ${COUNT}（失败 ${failures}），种子 ${SEED}，1950–2005，八城，now = ${NOW}。`,
  '',
];

// Replication check: the G0/B0/R0/D0 predicates must reproduce the engine's own yoga list.
const engineKey: Record<string, string> = {
  G0: 'gajakesari',
  B0: 'budha_aditya',
  R0: 'raja_yoga',
  D0: 'dhana_yoga',
};
const mismatches = Object.entries(engineKey).map(([id, key]) => {
  const opt = Object.values(OPTIONS)
    .flat()
    .find((o) => o.id === id)!;
  const bad = [...timed, ...noon].filter(
    (f) => opt.test(f) !== f.chart.yogas.some((y) => y.key === key),
  ).length;
  return `${id}=${bad}`;
});
lines.push(`复刻校验（现行规则与引擎输出不一致的盘数，应全为 0）：${mismatches.join('，')}。`, '');

lines.push('| 瑜伽 | 选项 | 条件 | 有时辰 | 正午盘 |', '|---|---|---|---|---|');
for (const [yoga, options] of Object.entries(OPTIONS))
  for (const o of options) {
    const noonCell = yoga === 'raja_yoga' || yoga === 'dhana_yoga' ? '不判定' : null;
    lines.push(
      `| ${yoga} | ${o.id} | ${o.label} | ${pct(rate(timed, o.test), timed.length)} | ${noonCell ?? pct(rate(noon, o.test), noon.length)} |`,
    );
  }

// Why the current rules are common.
const ba = timed.filter(sameSignSunMercury);
const gap = timed.map((f) => separation(f.get('surya'), f.get('budha')));
lines.push(
  '',
  '**诊断**',
  '',
  `- 日水角距：最大 ${Math.max(...gap).toFixed(1)}°，中位数 ${gap.sort((a, b) => a - b)[Math.floor(gap.length / 2)]!.toFixed(1)}°；日水同座的盘里水星焦伤占 ${pct(ba.filter((f) => f.get('budha').combust).length, ba.length)}。`,
);
const gk = timed.filter(jupiterInKendraFromMoon);
lines.push(
  `- 象狮：木星在月亮起算 1/4/7/10 的分布 ${KENDRA.map((k) => `${k}=${pct(gk.filter((f) => rel(f.get('guru'), f.get('chandra')) === k).length, gk.length)}`).join(' ')}；木星落陷或入敌宫 ${pct(gk.filter((f) => ['debilitated', 'enemy'].includes(f.get('guru').dignity)).length, gk.length)}，焦伤 ${pct(gk.filter((f) => f.get('guru').combust).length, gk.length)}，月亮离日 < 72° ${pct(gk.filter((f) => moonSun(f) < 72).length, gk.length)}。`,
);
for (const [name, houses] of [
  ['Raja', RAJA],
  ['Dhana', DHANA],
] as const) {
  const hit = timed.filter((f) => pairs(f, ...houses).length);
  const counts = hit.map((f) => pairs(f, ...houses).length);
  const inner = hit.filter((f) =>
    pairs(f, ...houses).every((p) =>
      [p.a.key, p.b.key].every((k) => ['surya', 'budha', 'shukra'].includes(k)),
    ),
  );
  lines.push(
    `- ${name}：命中盘平均 ${(counts.reduce((a, b) => a + b, 0) / (counts.length || 1)).toFixed(2)} 对同座主星；只由日、水、金三星组成的命中 ${pct(inner.length, hit.length)}；命中盘中至少一对相距 ≤ 10° 的 ${pct(hit.filter((f) => pairs(f, ...houses).some(pairClose)).length, hit.length)}。`,
  );
}
const yogakaraka = timed.filter((f) =>
  (['mangala', 'shukra', 'shani'] as Graha[]).some((k) => {
    const h = owned(f, k);
    return h.some((x) => RAJA[0].includes(x)) && h.some((x) => RAJA[1].includes(x));
  }),
);
lines.push(
  `- 有一颗行星同时管角宫和三方宫（yogakaraka，现行规则不计为 Raja）的盘 ${pct(yogakaraka.length, timed.length)}，由上升星座决定。`,
  `- 对照：Kemadruma（引擎 0.4.1 规则）有时辰 ${pct(timed.filter((f) => f.chart.yogas.some((y) => y.key === 'kemadruma')).length, timed.length)}，正午盘 ${pct(noon.filter((f) => f.chart.yogas.some((y) => y.key === 'kemadruma')).length, noon.length)}。`,
);

// Chart-level effect of the recommended and strict sets (keep in sync with §0 of the proposal).
const pick = (id: string) =>
  Object.values(OPTIONS)
    .flat()
    .find((o) => o.id === id)!.test;
const OTHERS = ['chandra_mangala', 'ruchaka', 'bhadra', 'hamsa', 'malavya', 'shasha'];
const LEFT = ['kemadruma', 'neecha_bhanga'];
const AUSPICIOUS = (f: Facts, ids: string[]) =>
  ids.filter((id) => pick(id)(f)).length +
  f.chart.yogas.filter((y) => OTHERS.includes(y.key)).length;
for (const [label, ids] of [
  ['现行', ['G0', 'B0', 'R0', 'D0']],
  ['推荐', ['G1', 'B1', 'R1', 'D1']],
  ['从严', ['G1+G2', 'B1+B2', 'R1+R2', 'D1+D2']],
] as const) {
  const counts = timed.map((f) => AUSPICIOUS(f, [...ids]));
  const four = timed.map((f) => ids.filter((id) => pick(id)(f)).length);
  const hist = [0, 1, 2, 3, 4].map(
    (k) =>
      `${k === 4 ? '≥4' : k}=${pct(counts.filter((c) => (k === 4 ? c >= 4 : c === k)).length, counts.length)}`,
  );
  const none = timed.filter(
    (f) => AUSPICIOUS(f, [...ids]) === 0 && !f.chart.yogas.some((y) => LEFT.includes(y.key)),
  );
  lines.push(
    `- ${label}（${ids.join('、')}）：四种里平均每盘 ${(four.reduce((a, b) => a + b, 0) / four.length).toFixed(2)} 个，四种都不中 ${pct(four.filter((c) => c === 0).length, four.length)}；连同 Chandra-Mangala 与五种 Mahapurusha，每盘吉祥/中性格局个数 ${hist.join(' ')}；十二种一个都不中（瑜伽一章只剩兜底段落）${pct(none.length, timed.length)}。`,
  );
}
lines.push('', `耗时 ${((Date.now() - started) / 1000).toFixed(1)} 秒。`);
console.log(lines.join('\n'));
