# 体系规范 · 塔罗

> 代码标识 `tarot`。主题：西方。不依赖出生信息。随机由 `seed` 驱动，可复现。

## 1. 用户视角的功能

1. 选择牌阵（§3），可输入问题（≤ 120 字）与类别（love, career, wealth, decision, self, general）。
2. **仪式流程**：洗牌（手指滑动或点击，≥ 1 次）→ 切牌（拖动分三叠，可跳过）→ 展开扇形 → 按牌阵数量逐张点选（或"替我抽"）→ 逐张翻牌（点击翻开，带 3D 翻转）→ 全部翻开后进入解读。
3. 正逆位开关（默认开）。
4. 解读：每张牌在其牌位上的含义（牌义 × 牌位 × 正逆 × 类别）、牌与牌之间的关系（元素互动、大牌占比、重复数字、宫廷牌数量）、综合结论、建议。
5. **每日一牌**：`/today` 中展示，seed = `sha256(userId|localDate|'daily-tarot')`，当日固定；匿名用户用 `anonId`（本地生成）。
6. 牌库百科：78 张牌的公共页（可索引），含图、关键词、正逆位义、象征、相关牌。

## 2. 牌组数据

- 牌组：Rider–Waite–Smith（RWS）78 张：22 大阿卡纳（0 愚人 … 21 世界）、56 小阿卡纳（权杖/圣杯/宝剑/星币 × Ace–10 + 侍从/骑士/王后/国王）。
- 图片：使用 1909 年 Pamela Colman Smith 原版扫描（美国公版，来源与许可核实见 appendix/research-libraries.md），统一裁切为 2:3.5 比例（如 600×1050 px），WebP + AVIF，命名 `tarot/rws/{key}.webp`。另制作一套**本站风格的牌背**（暗色星空 + 金色几何）。若最终决定使用自绘牌面，接口不变，只替换图片。
- 数据文件 `packages/content/tarot/cards.yaml`，每张：`key`（如 `major_00_fool`, `wands_07`, `cups_page`）、`number`、`arcana`、`suit`、`element`（权杖火、圣杯水、宝剑风、星币土；大牌按占星对应）、`astrology`（对应星座/行星，RWS–金色黎明体系）、`numerology`、`keywordsUpright[3–5]`、`keywordsReversed[3–5]`、`meaningUpright`（zh/en 各 120–180 字）、`meaningReversed`、`imagery`（画面象征 80 字）、`advice`、`yesNo`（yes / no / maybe，用于单张是非题）、`byCategory`（6 类 × 正逆 各 40–60 字）。

## 3. 牌阵

| key | 名称 zh / en | 张数 | 牌位（key: 名称 / 含义） | 布局坐标（相对 0–1） |
|---|---|---|---|---|
| `single` | 单张指引 / One Card | 1 | `focus` 核心指引 | (0.5, 0.5) |
| `yes_no` | 是非一问 / Yes or No | 1 | `answer` | 同上，输出 yes/no/maybe 与置信文案 |
| `three_ppf` | 过去·现在·未来 / Past-Present-Future | 3 | `past`, `present`, `future` | (0.2,0.5)(0.5,0.5)(0.8,0.5) |
| `three_sao` | 情境·行动·结果 / Situation-Action-Outcome | 3 | `situation`, `action`, `outcome` | 同上 |
| `relationship` | 关系牌阵 / Relationship | 5 | `you`, `them`, `connection`, `challenge`, `potential` | (0.25,0.35)(0.75,0.35)(0.5,0.5)(0.5,0.8)(0.5,0.15) |
| `decision` | 抉择牌阵 / Decision | 5 | `situation`, `option_a`, `option_a_outcome`, `option_b`, `option_b_outcome` | 中心 + 左右两列 |
| `celtic_cross` | 凯尔特十字 / Celtic Cross | 10 | `present`, `challenge`(横压), `foundation`(下), `past`(左), `crown`(上), `near_future`(右), `self`(柱1), `environment`(柱2), `hopes_fears`(柱3), `outcome`(柱4) | 经典布局，柱在右侧 |
| `year_ahead` | 年度牌阵 / Year Ahead | 13 | `theme` + `m01`…`m12` | 中心 + 12 环形 |

牌位含义文案（zh/en）存于 `spreads.yaml`，每个牌位附"读法提示"（如"挑战牌横置，不论正逆位都按正位读，强调其阻碍性质"——此为凯尔特十字惯例，一期采用并在专业视图标注）。

## 4. 抽牌算法

```
rng = xoshiro128ss(seed)
deck = [0..77]
shuffle(deck, rng)                       // Fisher–Yates
for each position i: card = deck[i]; reversed = allowReversed && rng.next() < 0.5
```

用户的"点选第几张"只影响动画，不影响结果（结果由 seed 决定，保证可复现与防作弊）；若希望用户选择产生真实差异，则 `seed = sha256(baseSeed + pickedIndices.join(','))`——**一期采用此法**，使用户的选择有意义，同时仍可复现。

## 5. 组合规则（用于解读）

- **大牌占比**：≥ 50% → "命运主题强，外力大于个人选择"。
- **元素统计**：某元素 ≥ 一半 → 该元素主题文案；缺某元素 → "缺火：行动力/热情不足"等。
- **宫廷牌 ≥ 2** → "牵涉他人/角色"。
- **数字重复**（如两张 5）→ 数字命理文案。
- **逆位占比 ≥ 60%** → "阻滞、内省、延迟"主题。
- **特定组合**（一期 30 组）：如 恋人 + 圣杯二、塔 + 死神、太阳 + 星星、宝剑三 + 圣杯三 等，给专门一段。
- **牌位关系**：三张牌阵的"趋势"（过去→未来元素是否转换、正逆转换）；凯尔特十字的"现状 vs 结果"对比。

## 6. 输出 Chart Schema

```ts
type TarotChart = {
  spread: SpreadKey; category: Category; question?: string;   // question 加密存储，chart 中不含明文（存 hash 以便去重即可）
  allowReversed: boolean;
  cards: Array<{ position: string; cardKey: CardKey; reversed: boolean; order: number }>;
  stats: { majorPct: number; elements: Record<Element4, number>; courtCount: number; reversedPct: number; repeatedNumbers: number[]; dominantElement?: Element4; missingElements: Element4[] };
  combos: string[];                 // 命中的组合 key
  yesNo?: { answer: 'yes'|'no'|'maybe'; confidence: number };
  seed: string;
};
```

## 7. 报告章节

| # | key | 标题 | 要点 |
|---|---|---|---|
| 0 | `overview` | 牌阵速读 / Reading Summary | 整体氛围一句话；三个关键词；若是 yes/no 直接给答案 |
| 1 | `cards` | 逐牌解读 / Card by Card | 每张：大图 + 牌位名 + 正/逆 + 关键词 + 牌义（在该牌位、该类别下的变体）+ 画面象征（折叠） |
| 2 | `dynamics` | 牌间关系 / The Story Between Cards | 元素/大牌/宫廷/数字统计结论；特定组合；趋势 |
| 3 | `answer` | 对你问题的回应 / Answer to Your Question | 按类别组合出的 200–300 字综述 |
| 4 | `advice` | 建议与提醒 / Advice | 3 条行动建议 + 1 条"值得反思的问题" |
| 5 | `learn` | 延伸学习 / Learn More | 每张牌的百科链接；牌阵读法 |

## 8. 交互与可视化（详见 02/03）

- **洗牌**：牌堆在屏幕中央，用户横向滑动或点击，牌以随机偏移抖动 + 位置交换动效（CSS transform，30–40 张可见代理元素，不渲染 78 个真实 DOM）。
- **切牌**：拖动把牌堆分为三叠，再点选合并顺序；可"跳过"。
- **展开**：78 张扇形/弧形展开（仅渲染可视的 ~25 张，滚动时虚拟化），用户点选所需张数；选中的牌飞到牌阵位置（Framer Motion `layoutId`）。
- **翻牌**：3D `rotateY` 翻转 0.6s，翻转中有金色边缘光；逆位牌翻开后旋转 180°。
- **牌阵布局**：按 §3 坐标渲染，移动端自动改为纵向滚动列表 + 顶部小缩略布局图。
- **音效**：洗牌沙沙声、翻牌声，默认关闭，一键开启（用户设置持久化）。
- **可访问性**：所有步骤有"替我抽牌"按钮；屏幕阅读器读牌名与正逆。

## 9. 核验与测试

- seed `"test-seed-001"` + `three_ppf` + 允许逆位 → 固化 3 张牌与正逆位为 fixture；更改 pickedIndices 应得到不同结果且同样可复现。
- 每日一牌：同一 userId + 日期多次调用结果一致；跨日变化。
- 组合规则：每条 1 正例 1 反例。
- 数据完整性：78 张牌 × 2 语言 × 全部字段非空；每张牌图片存在且尺寸一致。

## 10. 知识库维度

塔罗以**数据表为主**（78 牌 × 正逆 × 6 类别文案），KU 用于：牌位 × 牌义变体模板（10 个牌阵的全部牌位 ~40 条读法提示）、统计结论（~20）、组合（30）、按类别综述骨架（6）。KU 约 **100 条** + 牌数据 78 条（每条含约 20 个字段）。
