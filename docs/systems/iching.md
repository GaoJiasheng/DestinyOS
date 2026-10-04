# 体系规范 · 周易（梅花易数 + 六爻）

> 代码标识 `iching`。主题：东方。不依赖出生信息。两种子模式：`method: 'meihua' | 'liuyao'`。

## 1. 用户视角的功能

1. **提问**：用户输入问题（可选，≤ 120 字），选择问题类别（事业、财运、感情、健康、学业、出行、决策、其他）。类别影响解读 KU 的筛选。
2. **起卦方式**（梅花）：
   - `time`：以起卦时刻（用户当前时区，用农历年月日时）起卦。
   - `numbers`：用户报 2 个或 3 个数字（1–999）。
   - `random`：点击"抛掷"按钮，仪式动效后随机（seed）。
3. **六爻**：三枚铜钱摇六次。每次用户点击"摇"，动效中三枚铜钱落下，显示阴阳组合；也可"一键摇完"。seed 驱动。
4. 结果：本卦、互卦（梅花）、变卦，动爻，卦辞爻辞原文（可展开）+ 白话解释 + 针对问题类别的解读。六爻额外：装卦表（纳甲、六亲、六神、世应、伏神）、用神判定、旺衰简析。
5. 保存到历史，可分享（卡片显示卦象与一句话结论，不显示问题原文，除非用户勾选）。

## 2. 输入

```ts
type IchingInput = {
  method: 'meihua' | 'liuyao';
  question?: string;                                     // 加密存储
  category: 'career'|'wealth'|'love'|'health'|'study'|'travel'|'decision'|'other';
  meihua?: { castBy: 'time'|'numbers'|'random'; numbers?: number[]; at: ZonedDateTime };
  liuyao?: { throws?: Array<0|1|2|3> };                  // 每次正面(阳面)铜钱数量；缺省由 seed 生成 6 次
  seed: string;
};
```

## 3. 梅花易数算法

### 3.1 数的来源

- **时间起卦**（`at` 转农历，真太阳时不启用，用用户所在时区钟表时）：
  年数 = 地支序（子 1 … 亥 12）；月数 = 农历月；日数 = 农历日；时数 = 时辰序（子 1 … 亥 12）。
  上卦 = (年 + 月 + 日) mod 8；下卦 = (年 + 月 + 日 + 时) mod 8；动爻 = (年 + 月 + 日 + 时) mod 6。余 0 分别取 8 / 6。
- **报数起卦**：两数 n1, n2：上卦 = n1 mod 8，下卦 = n2 mod 8，动爻 = (n1 + n2 + 时数) mod 6。三数：动爻 = n3 mod 6。
- **随机**：seed 生成两个 1–64 的整数当作 n1, n2 并走报数流程（时数仍取当前时辰）。

先天八卦数：乾 1、兑 2、离 3、震 4、巽 5、坎 6、艮 7、坤 8。

### 3.2 卦象

- 本卦 = 上卦 ⊕ 下卦（64 卦编号用《周易》卦序 1–64，同时输出二进制 `lines: [bottom..top]`，1 阳 0 阴）。
- 互卦 = 本卦 2、3、4 爻为下卦，3、4、5 爻为上卦。
- 变卦 = 本卦动爻阴阳翻转。
- 错卦、综卦（专业视图可选）。

### 3.3 体用

- 动爻所在的卦为**用**，另一卦为**体**。
- 体用五行：乾兑金、离火、震巽木、坎水、坤艮土。
- 判断：用生体（吉）、体生用（泄、小耗）、用克体（凶）、体克用（可为、费力）、比和（顺遂）。互卦、变卦与体的生克作为"过程"与"结果"修饰。
- 旺衰：按起卦月令季节判断体卦五行旺相休囚死（春木旺火相水休金囚土死……）。
- 输出 `verdict: 'auspicious'|'favorable'|'neutral'|'unfavorable'|'inauspicious'`，与 `score 0–100`。

## 4. 六爻算法

### 4.1 摇卦

每次三枚铜钱，正面（阳面/字）数量：3 → 老阳（阳爻动，`○`）；2 → 少阴（阴爻静）；1 → 少阳（阳爻静）；0 → 老阴（阴爻动，`×`）。自下而上 6 次。

### 4.2 装卦

- 本卦、变卦（所有动爻翻转；无动爻则为静卦，用卦辞断；全动则用变卦卦辞）。
- **纳甲**（京房）：八宫卦各爻干支表（乾内卦甲子寅辰、外卦壬午申戌；坤内乙未巳卯、外癸丑亥酉；震内庚子寅辰、外庚午申戌；巽内辛丑亥酉、外辛未巳卯；坎内戊寅辰午、外戊申戌子；离内己卯丑亥、外己酉未巳；艮内丙辰午申、外丙戌子寅；兑内丁巳卯丑、外丁亥酉未），按上下卦分别取外卦与内卦。
- **卦宫与五行**：按八宫卦归属表确定本卦属宫（64 卦 → 八宫）。
- **六亲**：以卦宫五行为"我"，各爻地支五行：同为兄弟、生我父母、我生子孙、我克妻财、克我官鬼。
- **世应**：按八宫卦系（本宫卦世在六爻；一世卦在初爻……游魂四爻，归魂三爻）。
- **六神**：按起卦日干：甲乙 青龙起初爻，丙丁 朱雀，戊 勾陈，己 腾蛇，庚辛 白虎，壬癸 玄武，依次上行（青龙、朱雀、勾陈、腾蛇、白虎、玄武）。
- **伏神**：本卦六亲不全时，从本宫首卦取缺失六亲对应爻，标注伏于某爻之下。
- **月建、日辰**：起卦时刻的月支、日干支；旬空（日柱旬空）。
- **用神**：按类别：事业 → 官鬼；财运 → 妻财；感情 → 妻财（问对象为女）/官鬼（问对象为男）/应爻（泛问）；健康 → 世爻 + 官鬼为病；学业 → 父母（文书）+ 官鬼（名次）；出行 → 世爻与应爻、父母（车船）；决策 → 世应对比。
- **旺衰**：用神是否得月建日辰生扶、是否临空、是否发动、动化回头生/克、进退神（一期只做：月建日辰生克、空亡、发动、变爻生克）。
- 输出 `verdict` 与 `score`，并给出 `keyFindings: string[]`（规则命中 key，供解读组句）。

## 5. 64 卦数据

`packages/content/iching/hexagrams.yaml`：每卦包含：序号、名、拼音、英文名（Wilhelm 译名）、上下卦、二进制、卦辞原文、彖传（可选）、象传原文、六爻爻辞原文、用九/用六（乾坤）、白话卦义 150 字（zh/en）、每爻白话 60 字（zh/en）、关键词 3 个、按 8 个问题类别的一句话指引（zh/en）。原文为公版文本（《周易》通行本），白话由内容流水线生成并校对。

## 6. 输出 Chart Schema

```ts
type IchingChart = {
  method: 'meihua'|'liuyao';
  category: Category;
  castAt: { local: string; tz: string; lunar: {...}; dayGanZhi: {stem,branch}; monthBranch: Branch };
  primary: Hexagram;                       // 本卦
  changing: Hexagram | null;               // 变卦
  mutual?: Hexagram;                       // 互卦（梅花）
  movingLines: number[];                   // 1–6
  meihua?: {
    numbers: { upper: number; lower: number; moving: number; source: number[] };
    body: Trigram; use: Trigram;           // 体、用
    relation: 'use_generates_body'|'body_generates_use'|'use_controls_body'|'body_controls_use'|'same';
    seasonalStrength: 'prosperous'|'strong'|'resting'|'trapped'|'dead';
    mutualRelation: string; changingRelation: string;
  };
  liuyao?: {
    throws: Array<0|1|2|3>;
    lines: Array<{ position: 1|2|3|4|5|6; yang: boolean; moving: boolean; stem: Stem; branch: Branch; element: Element; relative: SixRelative; spirit: SixSpirit; isShi: boolean; isYing: boolean; changedTo?: {...} }>;
    palace: Trigram; palaceElement: Element;
    hidden: Array<{ relative: SixRelative; stem: Stem; branch: Branch; underLine: number }>;
    useGod: { relative: SixRelative; lines: number[]; state: UseGodState };
    voidBranches: Branch[];
    findings: string[];
  };
  verdict: Verdict; score: number;
};
type Hexagram = { number: number; key: string; lines: [0|1,0|1,0|1,0|1,0|1,0|1]; upper: Trigram; lower: Trigram };
type Trigram = 'qian'|'dui'|'li'|'zhen'|'xun'|'kan'|'gen'|'kun';
```

## 7. 报告章节

| # | key | 标题 | 要点 |
|---|---|---|---|
| 0 | `overview` | 卦象速读 / The Reading | 本卦名 + 一句话卦义；吉凶判定与分数；针对问题类别的一句话指引 |
| 1 | `hexagram` | 本卦解析 / Primary Hexagram | 卦辞原文（折叠）+ 白话；卦象意象（上下卦自然象）；关键词 |
| 2 | `moving_lines` | 动爻与变化 / Moving Lines | 每个动爻爻辞原文 + 白话 + 对问题的含义；多动爻的取用规则说明（一爻动看该爻；二爻动看上爻；三爻动看中爻；四爻动看下静爻；五爻动看静爻；六爻动看变卦） |
| 3 | `process_outcome` | 过程与结果 / Process & Outcome | 梅花：互卦（过程）与变卦（结果）解读；六爻：用神旺衰、世应关系、动爻变化 |
| 4 | `advice` | 行动建议 / Advice | 结合类别的 3 条建议；时机（梅花以体用旺衰推应期大致快慢；六爻以用神对应地支推"应在某地支日/月"，表述为"大约在……前后"） |
| 5 | `pro_view` | 专业视图 / Technical Details | 梅花：数的来源、体用生克表、旺衰；六爻：装卦全表 |

## 8. 交互与可视化

- **卦象图**：六根横线自下而上，阳爻实线、阴爻断线，动爻带金色标记（○ / ×）与微光动效；本卦→变卦有翻转过渡动画。
- **铜钱动效**：三枚铜钱 3D 翻转（CSS 3D transform，不用 Three.js）落到桌面，正反面随 seed 结果；每次 ~1.2s；"一键摇完"时六次串行加速到 0.4s/次。
- **报数输入**：大号数字键盘；时间起卦显示当前农历时刻。
- **问题输入**：占位文案"你此刻最想问的事……"，提示不填也可以。

## 9. 核验与测试

参考：元亨利贞六爻排盘（https://www.china95.net/paipan/liuyao/ ）、梅花易数在线起卦站。

- 梅花报数：n1=3, n2=5，时辰 辰(5)：上卦 3 离、下卦 5 巽、动爻 (3+5+5) mod 6 = 1 → 火风鼎（50）初爻动，变卦 火天大有（14）；体巽木，用离火（动爻在下卦）→ 体生用。
- 梅花时间：农历 2026 丙午年（午 7）六月十五 午时（7）：上 (7+6+15) mod 8 = 28 mod 8 = 4 震；下 (28+7) mod 8 = 35 mod 8 = 3 离；动爻 35 mod 6 = 5 → 震上离下 = 雷火丰（55）五爻动。
- 六爻摇得 [3,1,2,2,1,0]（自下而上）→ 初爻老阳动、二少阳、三少阴、四少阴、五少阳、上老阴动：本卦 lines [1,1,0,0,1,0] → 下卦 兑（1,1,0），上卦 坎（0,1,0）→ 水泽节（60）；变卦 lines [0,1,0,0,1,1] → 下 坎、上 巽 → 风水涣（59）。核对纳甲：节卦属坎宫一世卦……（施工时按表核对并固化）。
- 单元测试：64 卦二进制 ↔ 卦序双向表、互卦 64 组、八宫归属 64 组、纳甲 8 宫 × 6 爻、六亲、世应 64 组、六神 10 干、多动爻取用 6 规则、体用生克 25 组、旺衰 5 季 × 5 行。

## 10. 知识库维度

`iching.primary.number`（64）、`movingLines`（每卦 6 爻 = 384 条爻辞白话，属数据而非 KU）、`meihua.relation × category`（5 × 8 = 40）、`meihua.seasonalStrength`（5）、`liuyao.useGod.state × category`（~8 × 8 = 64）、`liuyao.findings` 规则句（~40）、`verdict × category` 建议（5 × 8 = 40）。KU 总量约 **200 条** + 64 卦与 384 爻的数据条目。
