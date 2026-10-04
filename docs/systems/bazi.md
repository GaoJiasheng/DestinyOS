# 体系规范 · 八字（四柱命理）

> 代码标识 `bazi`。主题：东方。依赖出生时间（可缺）。依赖出生地（可缺，缺则不做真太阳时）。

## 1. 用户视角的功能

1. 输入出生信息 → 得到命盘：四柱（年月日时）天干地支、藏干、十神、纳音、十二长生、空亡、神煞。
2. 五行分布与身强身弱评分、喜用神与忌神（带评分过程）。
3. 大运列表（10 步，含起运年龄与年份）、流年（当前年 ±10）、当年流月。
4. 报告 8 章（见 §7）。
5. 专业视图：原盘表格、流派参数、计算中间量（节气时刻、真太阳时修正量）。

## 2. 输入与选项

```ts
type BaziOptions = {
  school: {
    ziHour: 'zi_unified' | 'zi_split';           // 默认 zi_unified（见 04 §4）
    useApparentSolarTime: boolean;                // 默认 true
    strengthMethod: 'weighted_v1';                // 身强弱算法版本，便于以后换
  };
  now: ZonedDateTime;                             // 用于确定"当前大运/流年"
  yearsAround: number;                            // 流年范围，默认 10
};
```

## 3. 排盘算法

### 3.1 四柱

1. 由 `NormalizedBirth.solarTime.local`（启用真太阳时）或 `local`（未启用）得到排盘用本地时间 `T`。
2. **年柱**：找 `T` 所在的"立春年"：若 `T` 早于当年立春精确时刻，年柱为上一年。年柱干支 = 六十甲子中 `(year − 4) mod 60`（1984 甲子）。
3. **月柱**：以 12 个"节"（立春、惊蛰、清明、立夏、芒种、小暑、立秋、白露、寒露、立冬、大雪、小寒）的精确时刻为界，确定月支（立春起寅月）。月干用五虎遁：年干甲己 → 寅月丙；乙庚 → 戊；丙辛 → 庚；丁壬 → 壬；戊癸 → 甲，按月支顺推。
4. **日柱**：由 `T` 的日期查六十甲子（库提供）。`zi_unified` 下 23:00 及以后的时间日期已经是次日（在 `T` 的层面处理，即 23:00–23:59 视作次日 0 点时辰"子"）。`zi_split` 下 23:00–23:59 日柱不变，仅时柱按次日日干起。
5. **时柱**：时支由时辰确定；时干用五鼠遁：日干甲己 → 子时甲；乙庚 → 丙；丙辛 → 戊；丁壬 → 庚；戊癸 → 壬，按时支顺推。时辰未知 → 时柱 `null`。

### 3.2 派生要素（逐柱）

- **藏干**：地支本气/中气/余气表（子：癸；丑：己癸辛；寅：甲丙戊；卯：乙；辰：戊乙癸；巳：丙戊庚；午：丁己；未：己丁乙；申：庚壬戊；酉：辛；戌：戊辛丁；亥：壬甲）。
- **十神**：以日干为"我"，对其他天干与藏干计算：比肩、劫财、食神、伤官、偏财、正财、七杀、正官、偏印、正印。日干本身标 `day_master`。
- **纳音**：六十甲子纳音表（如庚午辛未路旁土）。
- **十二长生**：日干对各柱地支的长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养（阳干顺行、阴干逆行，表驻常量）。
- **空亡**：以日柱所在旬确定旬空两支，标注年、月、时支是否落空。
- **地支关系**：六合、三合（含半合）、六冲、三刑、六害、六破，列出所有柱对关系。
- **天干关系**：五合（甲己、乙庚、丙辛、丁壬、戊癸）、四冲（甲庚、乙辛、丙壬、丁癸）。

### 3.3 神煞（一期 20 个）

天乙贵人、太极贵人、天德贵人、月德贵人、文昌贵人、学堂、词馆、国印、驿马、华盖、桃花（咸池）、红艳、将星、金舆、羊刃、飞刃、禄神、天罗地网、孤辰寡宿、魁罡（含日柱魁罡四日）。每个神煞用常量表 + 查表函数实现，输出 `{ name, basedOn: 'day_stem'|'year_branch'|'day_branch'|'month_branch', hitsPillar: ('year'|'month'|'day'|'hour')[] }`。查表依据以《三命通会》通行表为准，表格直接写在代码常量里并在注释给出口诀，便于核对。

### 3.4 大运

1. 阳年（年干阳）男命与阴年女命**顺行**，阴年男与阳年女**逆行**。
2. 起运：顺行算出生到**下一个节**的时间差，逆行算到**上一个节**的时间差。按 3 天 = 1 岁、1 天 = 4 个月、1 小时 = 5 天折算。输出 `startAge: { years, months, days }` 与 `startDate`（公历）。
3. 大运干支从月柱起顺/逆排 10 步，每步 10 年；给出每步起止年份与起止虚岁/周岁。
4. 时辰未知时按 12:00 计算并给 warning。

### 3.5 流年 / 流月 / 流日

- 流年：以立春为界的年柱，输出当前年 ±`yearsAround`，每年附对日主十神、与原局四柱地支的冲合刑害、与当前大运的关系。
- 流月：当年 12 节月的月柱。
- 流日：每日运势用（见 daily.md）。

## 4. 五行分布

统计方法（透明，输出每项贡献）：

| 来源 | 权重 |
|---|---|
| 天干（年、月、时） | 1.0 各 |
| 日干（日主） | 1.0（计入分布，身强弱评分时另算） |
| 地支本气 | 1.0 |
| 地支中气 | 0.5 |
| 地支余气 | 0.3 |
| 月令（月支本气）额外加权 | +1.0 |

输出 `{ wood, fire, earth, metal, water }` 原始分与百分比，UI 画五行环。

## 5. 身强弱与喜用神（`weighted_v1`）

得分从日主视角：

1. **得令**（月令）：月支本气五行与日主相同或生日主 → +3；与日主同五行但为中气 → +1.5；克/泄/耗日主 → 0。
2. **得地**：年、日、时支藏干中生扶日主的：本气 +1，中气 +0.5，余气 +0.3。
3. **得势**：天干中生扶日主的，每个 +1；与日主有合化变性的按合化后五行计（一期不做合化，注明）。
4. **耗泄克**：所有克、泄、耗日主的要素按相同权重计负分。
5. 总分 `S = 生扶 − 克泄耗`。判定：`S ≥ 2.5` 身强；`−2.5 < S < 2.5` 中和；`S ≤ −2.5` 身弱。另外若生扶要素中仅有日主自身 + 月令不得 → 直接身弱。
6. **喜用**：身强 → 喜克泄耗（官杀、食伤、财）；身弱 → 喜生扶（印、比劫）；中和 → 以调候为主（见 7）。输出 `favorable: Element[]`、`unfavorable: Element[]`、`useGod: TenGodGroup`，并附 `rationale: string[]`（规则命中的 key 列表，供解读引擎组句）。
7. **调候**：按月支季节：冬（亥子丑）月且局中火少 → 加火为调候；夏（巳午未）月水少 → 加水。调候以标签形式输出，不改变喜用主判断，但解读会提及。
8. **格局**（简化）：月令本气透干 → 以该十神定格（正官格、七杀格、正财格、偏财格、食神格、伤官格、正印格、偏印格）；不透则以月令本气十神为格；比肩/劫财月令 → 建禄格/月刃格。特殊格局（从格、专旺）一期仅检测"极端身弱且无根 → 标注疑似从格"并给 warning，不深入。

**置信度**：时辰未知 −30%；中和带 −15%；输出 `confidence: 0–1`，解读里用"倾向于"措辞。

## 6. 输出 Chart Schema

```ts
type BaziChart = {
  pillars: {
    year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null;
  };
  dayMaster: { stem: Stem; element: Element; yinYang: 'yin'|'yang' };
  elements: { raw: Record<Element, number>; pct: Record<Element, number>; contributions: Contribution[] };
  strength: { score: number; level: 'strong'|'balanced'|'weak'; details: StrengthDetail[]; confidence: number };
  useGod: { favorable: Element[]; unfavorable: Element[]; group: 'support'|'drain'|'balance'; tiaoHou?: Element; rationale: string[] };
  pattern: { name: PatternKey; viaStem: boolean; notes: string[] };
  relations: { stems: StemRelation[]; branches: BranchRelation[] };
  voidBranches: Branch[];
  shenSha: ShenShaHit[];
  luck: {
    direction: 'forward'|'backward';
    startAge: { years: number; months: number; days: number };
    startDate: string;
    periods: Array<{ index: number; stem: Stem; branch: Branch; fromYear: number; toYear: number; fromAge: number; toAge: number; tenGod: TenGod; branchTenGod: TenGod; isCurrent: boolean }>;
  };
  years: Array<{ year: number; stem: Stem; branch: Branch; tenGod: TenGod; relationsToNatal: BranchRelation[]; isCurrent: boolean }>;
  months: Array<{ index: number; stem: Stem; branch: Branch; fromDate: string; toDate: string }>;
  solarTerms: { prevJie: { name: string; at: string }; nextJie: { name: string; at: string } };  // 排盘用
  solarTimeAdjust: { enabled: boolean; offsetMinutes: number | null; original: string; adjusted: string | null };
};

type Pillar = {
  stem: Stem; branch: Branch;
  stemElement: Element; branchElement: Element;
  hiddenStems: Array<{ stem: Stem; role: 'main'|'middle'|'residual'; tenGod: TenGod }>;
  tenGod: TenGod | 'day_master';       // 天干对日主
  naYin: string;                       // key，如 'lu_pang_tu'
  lifeStage: LifeStage;                // 十二长生
  isVoid: boolean;
};
```

`Stem` = `'jia'|'yi'|'bing'|'ding'|'wu'|'ji'|'geng'|'xin'|'ren'|'gui'`；`Branch` = `'zi'|'chou'|'yin'|'mao'|'chen'|'si'|'wu'|'wei'|'shen'|'you'|'xu'|'hai'`（注意天干"戊"与地支"午"拼音都是 wu，为避免歧义：天干戊用 `'wu_stem'`，地支午用 `'wu'`——**全仓库统一**）。

## 7. 报告章节（解读引擎按此骨架组文）

| # | 章节 key | 标题（zh / en） | 内容要点 | 主要触发维度 |
|---|---|---|---|---|
| 0 | `overview` | 命盘概览 / Your Chart at a Glance | 日主一句话人设；身强弱 + 喜用一句话；三个关键词；五维评分（事业、财富、感情、健康、人际 1–5） | dayMaster × strength × pattern |
| 1 | `day_master` | 日主与性格底色 / Day Master & Core Nature | 十天干人格原型（甲木如大树……）；阴阳；坐支（日支）对性格的修饰；日主在各支的长生状态 | dayMaster, dayBranch, lifeStage |
| 2 | `elements` | 五行格局与喜忌 / Elemental Balance | 五行环说明；过旺/缺失五行的生活表现；喜用神怎么用（颜色、方位、行业、季节）；忌神要避什么 | elements, useGod |
| 3 | `pattern_career` | 格局与事业 / Life Pattern & Career | 格局含义；十神中官杀、食伤、印的配置 → 工作风格、适合的行业簇（给 3 类）、领导/专业/创意倾向 | pattern, tenGods |
| 4 | `wealth` | 财富观与理财 / Wealth | 正财偏财有无、强弱、藏透；财星与日主关系（身强担财/身弱财多）；理财建议（风格而非具体投资） | tenGods.wealth × strength |
| 5 | `love` | 感情与婚姻 / Love & Partnership | 配偶星（男财女官）状态；日支（配偶宫）；桃花、红艳、孤辰寡宿；相处模式与注意点；**不预测具体年龄结婚**，只说"感情容易活跃的阶段"（结合大运） | spouseStar, dayBranch, shenSha, luck |
| 6 | `health` | 健康与作息 / Wellbeing | 五行对应脏腑系统的通俗版（木肝胆/情绪，火心血/睡眠……）；过旺过弱对应的注意点；季节性建议；**明确非医疗建议** | elements |
| 7 | `luck_timeline` | 大运与流年 / Life Cycles | 当前大运解读；前后两步大运对比；未来 3 年流年逐年 150 字；时间线图 | luck, years |
| 8 | `shensha_notes` | 神煞与特殊标记 / Special Markers | 命中神煞逐条通俗解释（贵人、驿马、华盖……）；空亡的含义；专业视图入口 | shenSha, voidBranches |
| 9 | `summary_actions` | 总结与行动清单 / Summary & Actions | 五条可执行建议（来自各章 KU 的 `advice` 字段按权重去重后选 5）；免责声明 | all |

## 8. 命盘可视化（前端规范，详见 02/03）

- **四柱表**：4 列（年月日时）× 行（天干、地支、藏干、十神、纳音、长生、神煞），移动端横向滑动，天干地支大字（东方主题衬线体 48px），五行颜色：木 `#3FA66B`、火 `#D9483B`、土 `#C8963E`、金 `#D8D4C8`、水 `#3C7DD9`。
- **五行环**：圆环分五段按百分比；中心显示日主。
- **身强弱标尺**：−6 … +6 水平刻度，指针落点动画。
- **大运轴**：横向时间轴，10 格，当前高亮，点击展开该运流年。
- **地支关系图**：四支围成菱形，用线标合（金色实线）、冲（红色虚线）、刑害（灰色点线）。

## 9. 核验与测试用例

参考站点：问真八字排盘（App）、元亨利贞八字排盘（https://www.china95.net/paipan/bazi/ ）、以及 `lunar` 库自带的 demo 页。施工时用参考站点核对下列期望，再把完整 chart 固化为 fixture。

| Fixture | 期望四柱（zi_unified, 真太阳时开） | 备注 |
|---|---|---|
| A 1990-05-15 08:30 北京 男 | 年 庚午 · 月 辛巳 · 日 庚辰 · 时 庚辰 | 北京经度 116.4 → Δ1 ≈ −14 分，均时差 5 月中 ≈ +4 分，修正后约 08:20，仍为辰时 |
| B 1985-11-02 23:40 上海 女 | 日柱为 **11-03** 的日柱（zi_unified 换日）；`zi_split` 下日柱保持 11-02，时柱按 11-03 日干起子时 | 验证两种流派分别产生不同 fixture |
| C 2000-02-04 20:00 广州 男 | 立春 2000-02-04 20:40（北京时间）；广州真太阳时修正约 −27+(−14) ≈ −41 分 → 19:19，早于立春 → 年柱 **己卯**，月柱 **丁丑** | 核心边界用例 |
| D 1988-07-10 14:00 纽约 女 | 纽约 EDT 偏移 −4h → L0 = −60°；经度 −74.01 → Δ1 = −56 分；均时差 7 月初 ≈ −5 分；真太阳时 ≈ 12:59 → 午时 | 西经 + 夏令时 |
| E 1995-08-20 无时辰 悉尼 | 时柱 null；warning `W_NO_HOUR_PILLAR` | |
| G 1960-01-01 00:30 香港 | 子时（早子），日柱为 1960-01-01，两流派一致 | |

**单元测试清单**（至少）：五虎遁 12 组、五鼠遁 12 组、六十甲子纳音全表、十神 10×10 矩阵、藏干 12 支、长生 10 干 × 12 支、空亡 6 旬、三合六合六冲全表、起运算法 4 组（阳男顺、阴男逆、阳女逆、阴女顺）、身强弱评分 6 组手算用例、立春边界 3 组、晚子时 2 流派各 2 组、真太阳时 3 城市。

## 10. 解读知识库维度（给 05 与内容生产用）

KU 触发条件可用的字段（`bazi.*`）：`dayMaster.stem`、`dayMaster.element`、`strength.level`、`useGod.favorable`、`pattern.name`、`pillars.day.branch`、`pillars.*.tenGod`、`elements.pct.*`（阈值）、`shenSha[].name`、`relations.branches[].type`、`luck.periods[isCurrent].tenGod`、`years[isCurrent].tenGod`、`voidBranches`。

预计 KU 数量：日主 10 × 章节 2 = 20；日主 × 身强弱 30；格局 10 × 3 章 = 30；十神配置 ~60；五行过旺/缺失 10 × 2 = 20；神煞 20；地支关系 ~24；大运十神 10 × 2（身强/弱）= 20；流年十神 10 × 2 = 20；日支 12；调候 4；合计约 **260 条**，中英各一。
