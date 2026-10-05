# 05 · 解读引擎与知识库（@tianji/interpret + @tianji/content）

> 决策 D5/D6：运行时不调用 LLM。解读 = 结构化知识库（Knowledge Units, KU）+ 确定性组合算法。本文定义 KU 的 schema、触发条件语言、组合与冲突处理、写作规范、离线生产流水线、质量检查。

## 1. 设计目标

1. **可追溯**：报告中每一段都能指出来自哪条 KU、被哪个命盘要素触发（专业视图显示）。
2. **读起来像文章**：有开头、过渡、让步、总结，不是条目堆叠。
3. **不自相矛盾**：互斥 KU 有冲突解决规则。
4. **双语各自成文**：zh 与 en 是两份独立写作，不是翻译。
5. **可扩展**：新增体系或新增流派只增加 YAML 文件与触发字段，不改引擎。
6. **可离线生产**：KU 内容由模型按本规范批量生成，人工抽查，版本化入库。

## 2. 知识单元（KU）Schema

文件：`packages/content/<system>/<topic>.yaml`，每文件一个 KU 数组。JSON Schema 在 `packages/content/schema/ku.schema.json`。

```yaml
- id: bazi.day_master.jia.strong          # 全局唯一，点分层级：system.topic.key[.variant]
  system: bazi                            # bazi|ziwei|iching|qimen|tarot|astrology|vedic|numerology|daily|common
  section: day_master                     # 所属章节 key（各体系文档的章节表）
  topic: day_master                       # 主题，用于冲突分组与去重
  when:                                   # 触发条件（见 §3）
    all:
      - { path: dayMaster.stem, eq: jia }
      - { path: strength.level, eq: strong }
  weight: 80                              # 0–100 基础权重；越高越先出现、越可能被选中
  polarity: neutral                       # positive|negative|neutral|mixed，用于平衡语气与评分提示
  tags: [personality, drive]              # 自由标签，供"关键词"抽取与检索
  exclusive_with: [bazi.day_master.jia.weak]   # 互斥 KU（同主题不同结论），由冲突解析处理
  scores:                                 # 对五维评分的贡献（可选，-3..+3）
    career: 1
    social: -1
  variables:                              # 组文时可替换的占位变量（可选）
    element_color: "{{glossary.element.wood.colors}}"
  zh:
    title: 甲木日主，身强：一棵根基扎实的大树
    summary: 你像一棵长在厚土里的大树，立得稳、长得直，也不太容易被人改变方向。
    body: |
      日主甲木代表……（200–400 字，结构：结论 → 为什么（引用命盘要素）→ 生活例子 → 注意点）
    advice:
      - 把"固执"用在长期目标上，而不是日常争执里。
      - 身强的人适合主动创造压力：接一个比现在能力高半档的任务。
    do: [立长期计划, 主动承担]
    dont: [硬碰硬, 拒绝建议]
    sources:                              # 可选：古文/经典出处，UI 以折叠块显示
      - text: "甲木参天，脱胎要火……"
        from: 《滴天髓》
  en:
    title: "Jia Wood Day Master, Strong: A Tree with Deep Roots"
    summary: "You are like a tall tree planted in thick soil: steady, upright, and not easily bent by others."
    body: |
      ...
    advice: [...]
    do: [...]
    dont: [...]
    sources: [...]
  meta:
    author: pipeline-v1                   # 生产来源
    reviewed_by: null                     # 人工抽查人
    version: 1
    status: draft                         # draft|published|deprecated
```

**字段约束**：
- `zh.body` 200–450 字（概览章 120–200），`en.body` 120–300 词。
- `summary` ≤ 60 字 / 35 词。
- `advice` 1–3 条；`do`/`dont` 0–3 条，每条 ≤ 6 字 / 3 词。
- 每条 KU 必须 zh、en 同时存在；校验失败不允许发布。
- 禁用词扫描（§7）通过。

## 3. 触发条件语言（`when`）

```yaml
when:
  all: [cond, ...]        # 与
  any: [cond, ...]        # 或
  not: cond               # 非
cond:
  path: <JSONPath-lite>   # 指向 chart 的字段：a.b.c、arr[*].x、arr[isCurrent=true].tenGod
  eq: value | in: [..] | gte: n | lte: n | contains: value | exists: true
```

- `path` 支持：点路径、`[*]`（任意元素）、`[key=value]` 过滤、`.length`。
- 所有 `path` 必须在该体系 Chart Schema 中存在，内容校验脚本会用 Fixture 校验路径可解析（防止写错字段名的 KU 永远不触发）。
- 复合特征（如"官杀混杂""财多身弱""三合火局"）由引擎在 chart 上预计算成布尔 `features.*` 字段（各体系文档的"知识库维度"节列出），KU 只需 `path: features.guan_sha_hun_za, eq: true`，避免在 YAML 里写复杂逻辑。

## 4. 组合算法

输入：`chart`、`locale`、`knowledgeBundle`（该体系全部 published KU + glossary）、`sectionPlan`（体系文档的章节表）。

```
1. 评估：对每条 KU 评估 when → hits[]（含 unitId, weight, evidence: 命中的 path/值）
2. 权重修正：
   - 体系特定乘数（如紫微 brightness、八字 confidence、塔罗牌位权重）
   - 命中条件的"具体度"加分：all 条件数 × 3（更具体的 KU 优先于泛化 KU）
3. 冲突解析：
   - 同 topic 且 exclusive_with 互斥的，只保留权重最高者
   - 同 topic 非互斥但 polarity 相反的，保留两者但在组文时用"不过/同时"让步句连接，并把权重低者截断为 summary
   - 同 section 内 KU 上限：概览 3，正文章 4–6（按体系章节表），超出按权重截断
4. 分章：按 section 分组并排序（weight desc）
5. 组文（每章）：
   - 章首句：取本章最高权重 KU 的 summary 作"结论句"
   - 正文：依次拼接 KU.body；相邻两段用过渡模板（§5）衔接；polarity 变化时用让步过渡
   - 依据块：汇总本章所有 evidence → "依据：日主甲木、月令酉金、身强（得分 +3.5）"，UI 渲染为可点击标签链接到命盘高亮
   - 建议：合并本章 advice，去重（文本相似度 > 0.8 视为重复），取前 3
   - 原文块：合并 sources，折叠显示
6. 概览章特殊处理：
   - 三个关键词 = 从全部 hits 的 tags 中按权重累加取前 3，映射为 glossary 中的展示词
   - 五维评分 = 体系基础分（如八字由身强弱/十神配置算出，各体系文档定义）+ Σ KU.scores，钳位 1–5
   - 一句话人设 = 概览 KU 的 summary
7. 总结章：合并全报告 advice（去重）取 5 条；加免责声明 KU（common.disclaimer）
8. 可读性检查（§7）→ report.readability
9. 输出 Report（见 §6）
```

**确定性**：相同 chart + 相同 knowledgeVersion → 相同 report；过渡模板的选择用 `hash(unitId)` 而不是随机。

## 5. 过渡与句式模板

`packages/content/common/transitions.yaml`，按 locale：

| 类型 | zh 示例 | en 示例 |
|---|---|---|
| 顺接 | 「与此同时，」「更进一步看，」「另一个值得注意的地方是，」 | "At the same time," "Looking further," "Another notable point:" |
| 让步 | 「不过，」「但也要看到，」「话虽如此，」 | "That said," "Still," "On the other hand," |
| 依据引入 | 「这一点来自」「之所以这样说，是因为」 | "This comes from" "The reason is" |
| 建议引入 | 「可以试试：」「实际做法上，」 | "Try this:" "In practice," |
| 置信度低 | 「倾向于」「大概率」「在缺少时辰的情况下，这只是一个方向」 | "tends to" "likely" "Without a birth time, treat this as directional" |

规则：同一章节内不重复使用同一过渡词；`confidence < 0.7` 时结论句自动加置信度修饰。

## 6. Report 输出 Schema

```ts
type Report = {
  system: System; locale: Locale;
  knowledgeVersion: string; engineVersion: string; interpretVersion: string;
  headline: { persona: string; keywords: string[]; scores: Record<Dim, 1|2|3|4|5>; confidence: number };
  sections: Array<{
    key: string; title: string;
    lead: string;                                 // 结论句
    blocks: Array<
      | { type: 'paragraph'; text: string; unitId: string; polarity: Polarity }
      | { type: 'transition'; text: string }
      | { type: 'evidence'; items: Array<{ label: string; path: string; value: string; anchor: string }> }
      | { type: 'advice'; items: string[] }
      | { type: 'sources'; items: Array<{ text: string; from: string }> }
      | { type: 'chart_ref'; component: string; props: Record<string, unknown> }   // 章节内嵌命盘局部图
    >;
  }>;
  hits: Array<{ unitId: string; weight: number; section: string; evidence: Evidence[] }>;
  doDont?: { do: string[]; dont: string[] };
  readability: { zhChars: number; enWords: number; termDensity: number; passed: boolean; issues: string[] };
  disclaimerKey: string;
};
```

术语卡：组文时扫描 `glossary` 中的词条，在首次出现处包裹 `<term key="...">`（在 Markdown-like 文本里用 `[[term:key]]` 标记），前端渲染为虚线下划线 + 弹层。

## 7. 质量检查（content:validate 与运行时）

**静态（CI 必过）**：
1. Schema 校验；zh/en 齐全；字数范围。
2. `when.path` 在 Fixture 上可解析。
3. 每个 `exclusive_with` 双向一致。
4. **覆盖率**：对 Fixture A–G 以及随机生成的 500 个合法出生数据跑全流程，每个体系每一章节至少命中 1 条 KU；任一章节空洞率 > 1% 则失败并列出缺口（这是防止"某些命盘报告很短"的关键）。
5. **禁用词**：恐吓/绝对化词表（必有大灾、注定、克死、短命、离婚、破产、死亡、绝症、必然、100%、神准 等）与医疗/投资承诺词（治愈、根治、稳赚、必涨、保证）→ 出现即失败。英文同理（doomed, will die, guaranteed, cure, 100% accurate）。
6. **语气**：每条 KU 的 `body` 至少包含一条 `advice` 或建议性句式；`polarity: negative` 的 KU 必须有缓冲句（含「不过」「可以通过」「建议」之一）。
7. 重复检测：同 system 内任意两条 KU body 的 3-gram 相似度 > 0.6 → 警告（疑似复制粘贴）。

**运行时**：
- 报告总字数 zh ≥ 2500（占卜类 ≥ 1200）；en ≥ 1800 词（占卜类 ≥ 900）。
- 术语密度：每 100 字中 glossary 术语 ≤ 6 个（超过提示"晦涩"，组文时优先选 tags 含 `plain` 的变体）。
- 未替换占位符 `{{` 检测。

## 8. 写作规范（给内容生产模型的 Style Guide）

### 8.1 语气
- 像一位懂行、说人话、不吓人的朋友。第二人称「你」/"you"。
- 先说结论，再说为什么，再给例子，最后给建议。
- 不说"命中注定""必然"。用「倾向」「容易」「往往」「在……时期更明显」。
- 负面内容必须给出口：问题 → 表现 → 可以怎么做。
- 不涉及医疗诊断、法律结论、投资标的。健康章只谈作息、情绪、季节、"注意某系统的保养"。
- 不性别刻板、不婚育催促、不贬低单身/离异。配偶星解读用"伴侣"而非"丈夫/妻子"。
- 英文版：避免东方主义腔调和神秘化堆砌；术语首次出现给拼音 + 简释，如 "Day Master (日主, rì zhǔ — the stem that represents you)"。

### 8.2 结构模板（正文 KU）
```
[结论句] 1 句
[解释] 2–4 句：这个要素在命理里代表什么 → 在你盘里的具体位置/强度 → 因此表现为……
[例子] 1–2 句：工作/关系/日常里的一个具体场景
[注意/建议] 1–2 句（与 advice 字段呼应但不重复）
```

### 8.3 术语处理
- 正文允许使用术语，但首次出现后紧跟括号白话（zh）或破折号释义（en）。
- 古文只放 `sources`，不进 `body`。

### 8.4 变体
对同一触发条件，若需要避免千人一面，可写 `variant: a|b|c` 的多条 KU（id 后缀），引擎按 `hash(userId + unitId) mod n` 选择 —— 注意：这会让同一用户稳定看到同一变体，不同用户看到不同变体，仍是确定性的。一期对高频 KU（日主 × 身强弱、太阳星座、月亮星座、命宫主星）各写 2 个变体。

## 9. 离线生产流水线（构建期用模型，一次性）

```
packages/content/scripts/
  gen-plan.ts      # 读各体系 Chart Schema + 维度清单 → 生成 KU 任务清单（id、when、section、topic、polarity 预设）
  gen-draft.ts     # 对每个任务，用模型 API 生成 zh + en 草稿（prompt 模板在 prompts/*.md，包含 §8 规范 + 该体系的术语表 + 2 条高质量范例 + 禁用词表）
  lint.ts          # §7 静态检查，不过的打回重生成（最多 3 次）
  review-sample.ts # 按 5% 抽样生成人工审阅清单（Markdown），Owner 审阅后在 YAML 标 reviewed_by
  build.ts         # 编译为 dist/<system>.<locale>.json
  import-db.ts / export-db.ts
```

- 任务清单是**穷举式**的：按各体系文档"知识库维度"节的组合生成；总量约 2500 条 KU（八字 260、紫微 380、周易 200、奇门 220、塔罗 100 + 78 牌数据、西方 700、吠陀 450、每日 200），其中西方/吠陀的相位与宫头部分用"句式模板 + 变量"写法压缩。
- 生成模型由 Owner 决定（此处只定义接口：`generate(prompt) → text`），prompt 模板随文档交付在 `packages/content/prompts/`。
- 成本估算：2500 条 × 2 语言 × ~900 token 输出 ≈ 4.5M 输出 token，一次性。
- 版权：生成文本为原创；古文引用为公版；禁止抄录任何在版书籍段落。

## 10. 术语表（glossary）

`packages/content/glossary/*.yaml`：

```yaml
- key: day_master
  zh: { term: 日主, short: 代表你自己的那个天干, long: ... }
  en: { term: Day Master, pinyin: rì zhǔ, short: the heavenly stem that stands for you, long: ... }
  system: bazi
  aliases: [日元, 日干]
```

约 600 条，覆盖七体系 + 通用五行干支。前端术语卡、英文括注、评分维度名都从这里取。

## 11. 版本与发布

- 知识库版本号 `knowledgeVersion = <major>.<minor>.<patch>`，每次发布递增；Reading 记录生成时的版本。
- 后台编辑 KU → 保存为新 `version`，`status: draft` → 预览 → 发布。发布后 Redis 缓存按版本 key 自然失效。
- 旧报告不自动重算；用户可点"用最新解读重新生成"。

## 12. LLM 润色开关（预留，默认关）

`FEATURE_LLM_POLISH=true` 时，在组文第 5 步后对**每章纯文本**调用模型做润色（prompt：保持事实与结构不变，仅改善衔接与语气，不新增结论），输入**只含组好的文本**，不含用户姓名、生日、地点。一期不实现调用，只保留接口 `polish(sectionText, locale): Promise<string>` 的空实现与开关。

## B-10 · 生命灵数补充

`numerology` 使用同一 KU schema 与组合算法，125 条双语 KU；章节与触发维度详见 [systems/numerology.md](systems/numerology.md)。未知时辰不降低此体系的计算置信度；仍执行 zh≥2500 字 / en≥1800 词及 500 个合法生日覆盖检查。
