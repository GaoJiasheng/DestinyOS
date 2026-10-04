import type { BaziChart, Branch, Stem, ShenShaHit, ShenShaName } from '@tianji/shared';
import { STEMS, BRANCHES, mod } from '../common/ganzhi';
import { BRANCH_TRINES } from '../common/relations';
import { pillarEntries } from './pillars';
// Sources: 三命通会卷三 https://zh.wikisource.org/wiki/三命通會/卷三 ; common Ziping lookup variants are explicit below.
// Table indices: 甲乙丙丁戊己庚辛壬癸.
export const DAY_STEM_SHA: Record<
  Exclude<
    ShenShaName,
    | 'tian_de_gui_ren'
    | 'yue_de_gui_ren'
    | 'yi_ma'
    | 'hua_gai'
    | 'tao_hua'
    | 'jiang_xing'
    | 'tian_luo_di_wang'
    | 'gu_chen_gua_su'
    | 'kui_gang'
  >,
  readonly (readonly Branch[])[]
> = {
  // 甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢虎马。
  tian_yi_gui_ren: [
    ['chou', 'wei'],
    ['zi', 'shen'],
    ['hai', 'you'],
    ['hai', 'you'],
    ['chou', 'wei'],
    ['zi', 'shen'],
    ['chou', 'wei'],
    ['yin', 'wu'],
    ['mao', 'si'],
    ['mao', 'si'],
  ],
  // 甲乙子午，丙丁卯酉，戊己四季，庚辛寅亥，壬癸巳申。
  tai_ji_gui_ren: [
    ['zi', 'wu'],
    ['zi', 'wu'],
    ['mao', 'you'],
    ['mao', 'you'],
    ['chen', 'xu', 'chou', 'wei'],
    ['chen', 'xu', 'chou', 'wei'],
    ['yin', 'hai'],
    ['yin', 'hai'],
    ['si', 'shen'],
    ['si', 'shen'],
  ],
  // DESIGN-GAP: 文昌采用现代通行“甲巳乙午丙戊申，丁己酉庚亥辛子，壬寅癸卯”，古本另有文昌/文星异名。
  wen_chang_gui_ren: [
    ['si'],
    ['wu'],
    ['shen'],
    ['you'],
    ['shen'],
    ['you'],
    ['hai'],
    ['zi'],
    ['yin'],
    ['mao'],
  ],
  // DESIGN-GAP: basedOn 无年纳音选项，采用卷三“学堂会禄/官贵学堂”：官贵长生为学堂、临官为词馆，以日干查。
  xue_tang: [
    ['si'],
    ['si'],
    ['shen'],
    ['shen'],
    ['hai'],
    ['hai'],
    ['yin'],
    ['yin'],
    ['shen'],
    ['shen'],
  ],
  ci_guan: [
    ['shen'],
    ['shen'],
    ['hai'],
    ['hai'],
    ['yin'],
    ['yin'],
    ['si'],
    ['si'],
    ['hai'],
    ['hai'],
  ],
  // 国印：甲戌乙亥丙丑丁寅戊丑己寅庚辰辛巳壬未癸申（禄前八位）。
  guo_yin: [
    ['xu'],
    ['hai'],
    ['chou'],
    ['yin'],
    ['chou'],
    ['yin'],
    ['chen'],
    ['si'],
    ['wei'],
    ['shen'],
  ],
  // 红艳：甲乙午、丙寅丁未、戊辰己辰、庚戌辛酉、壬子癸申。
  hong_yan: [
    ['wu'],
    ['wu'],
    ['yin'],
    ['wei'],
    ['chen'],
    ['chen'],
    ['xu'],
    ['you'],
    ['zi'],
    ['shen'],
  ],
  // 金舆常居禄前二辰：甲辰乙巳丙戊未丁己申庚戌辛亥壬丑癸寅。
  jin_yu: [
    ['chen'],
    ['si'],
    ['wei'],
    ['shen'],
    ['wei'],
    ['shen'],
    ['xu'],
    ['hai'],
    ['chou'],
    ['yin'],
  ],
  // DESIGN-GAP: 羊刃采用十干阳顺阴逆帝旺表；飞刃取其对冲支，阴干不另用“禄前一位”变体。
  yang_ren: [['mao'], ['yin'], ['wu'], ['si'], ['wu'], ['si'], ['you'], ['shen'], ['zi'], ['hai']],
  fei_ren: [['you'], ['shen'], ['zi'], ['hai'], ['zi'], ['hai'], ['mao'], ['yin'], ['wu'], ['si']],
  // 甲寅乙卯丙戊巳，丁己午，庚申辛酉壬亥癸子。
  lu_shen: [['yin'], ['mao'], ['si'], ['wu'], ['si'], ['wu'], ['shen'], ['you'], ['hai'], ['zi']],
};
// 正月丁、二坤(申)、三壬、四辛、五乾(亥)、六甲、七癸、八艮(寅)、九丙、十乙、十一巽(巳)、十二庚。
export const TIAN_DE: readonly (Stem | Branch)[] = [
  'si',
  'geng',
  'ding',
  'shen',
  'ren',
  'xin',
  'hai',
  'jia',
  'gui',
  'yin',
  'bing',
  'yi',
];
// Trine order 申子辰 / 亥卯未 / 寅午戌 / 巳酉丑. 马居冲长生、盖居墓、桃花居沐浴、将星居帝旺。
export const TRINE_SHA = {
  yi_ma: ['yin', 'si', 'shen', 'hai'],
  hua_gai: ['chen', 'wei', 'xu', 'chou'],
  tao_hua: ['you', 'zi', 'mao', 'wu'],
  jiang_xing: ['zi', 'mao', 'wu', 'you'],
} as const;
// 寅卯辰见巳孤丑寡，巳午未见申孤辰寡，申酉戌见亥孤未寡，亥子丑见寅孤戌寡。
export const LONELY: readonly (readonly Branch[])[] = [
  ['yin', 'xu'],
  ['yin', 'xu'],
  ['si', 'chou'],
  ['si', 'chou'],
  ['si', 'chou'],
  ['shen', 'chen'],
  ['shen', 'chen'],
  ['shen', 'chen'],
  ['hai', 'wei'],
  ['hai', 'wei'],
  ['hai', 'wei'],
  ['yin', 'xu'],
];
// 日魁罡：庚辰、庚戌、壬辰、戊戌，非仅见辰戌。
export const KUI_GANG = ['geng:chen', 'geng:xu', 'ren:chen', 'wu_stem:xu'] as const;
/** Twenty named marker families; each hit retains its lookup basis and exact natal pillar evidence. */
export function computeShenSha(pillars: BaziChart['pillars']): ShenShaHit[] {
  const entries = pillarEntries(pillars),
    result: ShenShaHit[] = [];
  const add = (
    name: ShenShaName,
    basedOn: ShenShaHit['basedOn'],
    matches: (p: BaziChart['pillars']['day']) => boolean,
  ) => {
    const hitsPillar = entries.filter(([, p]) => matches(p)).map(([key]) => key);
    if (hitsPillar.length) result.push({ name, basedOn, hitsPillar });
  };
  const stemIndex = STEMS.indexOf(pillars.day.stem);
  for (const name of Object.keys(DAY_STEM_SHA) as (keyof typeof DAY_STEM_SHA)[])
    add(name, 'day_stem', (p) => DAY_STEM_SHA[name][stemIndex]!.includes(p.branch));
  const monthIndex = BRANCHES.indexOf(pillars.month.branch);
  const td = TIAN_DE[monthIndex]!;
  add('tian_de_gui_ren', 'month_branch', (p) => p.stem === td || p.branch === td);
  const monthTrine = BRANCH_TRINES.findIndex((group) =>
    group.some((b) => b === pillars.month.branch),
  );
  const md: readonly Stem[] = ['ren', 'jia', 'bing', 'geng'];
  add('yue_de_gui_ren', 'month_branch', (p) => p.stem === md[monthTrine]);
  for (const [basedOn, basis] of [
    ['year_branch', pillars.year.branch],
    ['day_branch', pillars.day.branch],
  ] as const) {
    const group = BRANCH_TRINES.findIndex((g) => g.some((b) => b === basis));
    for (const name of Object.keys(TRINE_SHA) as (keyof typeof TRINE_SHA)[])
      add(name, basedOn, (p) => p.branch === TRINE_SHA[name][group]);
  }
  add('gu_chen_gua_su', 'year_branch', (p) =>
    LONELY[BRANCHES.indexOf(pillars.year.branch)]!.includes(p.branch),
  );
  // DESIGN-GAP: 天罗地网采用支对简表：戌亥互见天罗、辰巳互见地网；不加性别/纳音限制。
  const nets: readonly (readonly Branch[])[] = [
    ['xu', 'hai'],
    ['chen', 'si'],
  ];
  add('tian_luo_di_wang', 'day_branch', (p) =>
    nets.some(
      (g) =>
        g.includes(pillars.day.branch) && g.includes(p.branch) && p.branch !== pillars.day.branch,
    ),
  );
  // DESIGN-GAP: §6 无 day_pillar basis，魁罡以 day_branch 标识，仍核对完整日干支。
  if (KUI_GANG.some((pair) => pair === `${pillars.day.stem}:${pillars.day.branch}`))
    result.push({ name: 'kui_gang', basedOn: 'day_branch', hitsPillar: ['day'] });
  return result;
}
// Keep index wrapping explicit for consumers auditing the opposite-branch rule.
/** Opposite branch, six positions away on the twelve-branch cycle. */
export function oppositeBranch(branch: Branch): Branch {
  return BRANCHES[mod(BRANCHES.indexOf(branch) + 6, 12)]!;
}
