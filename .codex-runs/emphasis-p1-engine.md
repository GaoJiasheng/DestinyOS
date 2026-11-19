# 紫微「命盘侧重」试点 · 施工包 P1：规则数据与计算（packages）

项目：/Users/gavin/work/DestinyOS（pnpm monorepo）。Owner 已批准 `docs/progress/SCORING-PROPOSAL-2026-11-16.md` 的全部建议（Q1–Q10 均按「建议」列）。**先完整读这份方案**，重点 §3.2、§4.1、§5、§6.3、§6.6、§8。本包只做 packages 侧；网页 UI 由后续的 P2 包做，App 不在试点范围。

代码约定沿用 `.codex-runs/ux-fix5-common.md` 的「代码约定」一节（DESIGN-GAP 注释、单文件 ≤400 行、禁止 any、注释英文只写为什么）。

## 目标
给紫微斗数报告算出「命盘侧重」（事业、财富、感情、人际四维，档位 2–5，附逐条依据），数据驱动、可审、确定性，默认关闭。

## 已定的取舍（与方案不同或方案未定之处，以这里为准）
1. **开关**：`interpret` 增加一个可选项（例如 `options.emphasis?: boolean`，默认 false）。不传或 false 时报告里没有 `emphasis` 字段，输出与现在逐字节一致（现有快照、夹具不许变）。上线前需要外部命理顾问签字（Q6），所以生产环境暂不开。
2. **不改 `headline.scores`**：方案 §5.2 说把 level 写进 `scores`，不做。原因：审核中的 iOS App 和旧界面看到五项不同会画出「x/5」数字雷达。`scores` 维持现状（全 3），侧重只放在新的可选字段 `headline.emphasis`。
3. **健康维不计算**（Q2）：`dims` 只有 career / wealth / love / social，`omitted: ['health']`。
4. **数值用整数**：方案写「乘 4」，但 Z7 有 0.375、Z2 借星减半会出现 0.125，所以统一乘 8 存整数；`raw` 对外仍是 0.125 的倍数。
5. **切点重新标定**（Q5）：方案里的 [0, 0.75, 1.375] 是五维合并的分位数。现在只有四维，按固定种子样本（N=2000、种子 20261116、1950–2005、方案 §6.1 的八个城市、`now` 固定）在四维合并的 20/50/80 分位上重新取值，写进 scoring.yaml 并冻结。标定脚本这次要进仓库（例如 `packages/interpret/scripts/` 或 `packages/content/scripts/` 下，名字自定），能重跑、输出分布统计。
6. **亮度表沿用 iztro 默认**（Q7），依据文案里注明「亮度按通行表」可放在规则说明或 UI 脚注的文案 key 里。
7. **生命灵数、合盘永久不做**（Q10）；八字、西方占星、吠陀本期不做。在 `SystemConfig`（`packages/interpret/src/types.ts`）里用一个显式字段表达「这个体系有没有侧重」，不要再靠「五项都是 3」推断。

## 交付物
1. **规则数据**：`packages/content/ziwei/scoring.yaml`，按方案 §5.2 的结构和 §8.1 的规则表（Z1–Z8b）。每条规则带 `id`、条件、分值、`reliability`、zh / en 依据文案模板（正负两种的分开写）。负向文案必须带一句可执行的建议，语气按 `docs/12-i18n-and-copy.md` §2，过 `docs/05` §7 的禁用词表。加上：四个档位词（5 突出 / 4 有支撑 / 3 平稳 / 2 多花心思；en：Standout / Supported / Steady / Takes more care）、四维 × 四档的一句话、概览句模板（「你的盘面侧重在{a}与{b}。」及只有一维突出等变体）、固定脚注（「侧重来自传统规则的组合，看的是这张盘里各领域的相对重心，不代表结果。」「本命盘不评估健康。」「不同体系观察的角度不同。」）。文案放 yaml 还是放别处由你定，但要满足：规则和它的文案能在同一处被顾问审阅；zh-TW 由现有 OpenCC 流程生成（不要手写繁体）。
2. **schema 与校验**：scoring.yaml 走 `packages/content` 现有的 schema 校验与构建流程（`scripts/validate.ts`、`scripts/build.ts`、`schema/`）。校验至少包括：delta 是 0.125 的倍数、group cap 合法、每条规则 zh/en 文案齐全且占位符一致、cutpoints 递增。
3. **盘面视图函数**：例如 `ziweiScoringView(chart)`，小、纯、有单元测试。输入是引擎的 `ZiweiChart`（`packages/shared/src/schemas/charts/ziwei.ts`），输出每个目标宫的事实（本宫主星与亮度、四化、六吉、六煞、禄存、天马、对宫主星与四化）。
4. **求值器**：按 §5.1（同组求和后按 cap 截断，raw 钳位 ±2.5，按 cutpoints 分档），规则按 id 排序执行，输出方案 §5.2 的 `emphasis` 结构（`version`、`dims[d] = { level, raw, basis[] }`、`top`（最多两维，raw 降序，平局按 dims 顺序；只把 level ≥ 4 的算进 top，全盘没有 ≥4 时 top 为空）、`omitted`）。`basis` 里每条是 `{ ruleId, delta, params }`，params 用稳定的 key（星曜 key、宫位 key、亮度 key、四化 key），**不放已本地化的文字**。Z1 在平地（delta 0）时也输出一条依据（方案 §8.3 财富例）。
5. **本地化渲染函数**：给 UI 用的纯函数，把一条 basis 加 locale 渲染成一句话（星名、宫名用现有术语表；zh / zh-TW / en）。要能在浏览器里用，体积要小：不要把整个知识库拖进客户端包。说明它该从哪个入口 import。
6. **类型**：`Report['headline']` 加可选 `emphasis`；如果 `packages/shared` 或 `apps/web/lib/reading-schema` 等处有对 report 的 zod 校验，一并放行这个可选字段（只加可选，不改现有字段）。
7. **接入 interpret**：紫微且开关打开时计算并写入 `headline.emphasis`；`localize-report.ts`（切换语言重渲染）必须原样保留已存的 `emphasis`，不重算。
8. **版本**：scoring.yaml 自带 `scoringVersion: 1.0.0`。**不要改** `packages/content/version.json`、`packages/engine/package.json`、interpret 的版本号，由主代理统一处理；需要升的理由写进汇报。
9. **测试**（vitest，仓库根目录 `npx vitest run <文件>`）：
   - 视图函数与求值器的单元测试；Fixture A 的结果必须等于方案 §8.3 的手算（事业 +1.25、财富 −1.0、感情 0、人际 +0.75；档位按新切点重新算，在汇报里写出）。
   - A–G 七个档案的黄金快照（档案在 `packages/engine/test/fixtures/`，找现有测试怎么取）。
   - 确定性：同盘重复计算深度相等；zh / en 两次 interpret 的 `emphasis` 完全相同；开关关闭时报告与现状相同。
   - 分布测试（固定种子；N 可以比 2000 小以控制耗时，但要说明）：阈值按方案 §6.6 第 1 条。跑不过时调规则或切点，并在汇报里说明，不要放宽阈值。
   - 文案检查：禁用词、负向规则带建议、占位符齐全。
10. **文档**：`docs/systems/ziwei.md` 加一节说明规则来源、分值、分档与开关；`docs/05-interpretation-engine.md` 里「五维评分 = 基础分 + Σ KU.scores」那段加注，说明本命体系改为命盘侧重、不走 KU.scores。另写一份给外部命理顾问的复核材料 `docs/progress/EMPHASIS-ZIWEI-REVIEW.md`：规则表（含分值与可靠度）、方案 §6.6 第 4 条的断语一致性清单、每维最高与最低各 10 张盘的盘面摘录与得分（由标定脚本生成）、需要顾问明确表态的问题（奴欺主、官禄宫煞星算激发还是阻碍、亮度表流派）。中文，写给懂紫微但不懂代码的人。

## 文件范围
- 可改：`packages/content/**`、`packages/interpret/**`、`packages/shared/src/**`（仅类型或 schema 的可选字段）、`docs/systems/ziwei.md`、`docs/05-interpretation-engine.md`、`docs/progress/EMPHASIS-ZIWEI-REVIEW.md`、仓库根 `package.json`（只为加一条标定脚本命令）。
- 不要改：`apps/**`（P2 包做；如果 apps 里有地方因为类型变化编译不过，在汇报里列出，不要动）、`packages/engine/**`（方案确认引擎零改动；发现确实缺字段时停下来在汇报里说明）、任何 `zh-TW*` 文件、版本号文件。

## 禁止
- 任何 git 写操作（commit / stash / checkout / reset / add）、部署、`next build`、启动 dev server、安装或升级依赖、改 eslint / tsconfig / perf 预算。
- 不要运行根目录的 `pnpm content:build` 和 `pnpm i18n:traditional`（会改繁体产物）。需要构建内容产物时只跑 `pnpm --filter @tianji/content content:build`；`pnpm content:validate` 可以跑。跑完如果产生了范围外的文件改动，在汇报里列出。
- 另一个目录 `/Users/gavin/work/DestinyOS-deploy` 正在做线上部署，不要碰。

## 自测
`npx vitest run packages/content packages/interpret packages/shared`、`npx eslint <你改的文件>`、`npx prettier --write <你改的文件>`、`npx tsc --noEmit -p packages/interpret`（以及 content、shared；以各包现有 tsconfig 为准）。

## 汇报（中文，1000 字以内）
1. 做了什么，按交付物编号逐条：已做 / 部分（剩什么）/ 未做（原因）。
2. 数据契约：`emphasis` 的最终类型定义原文、渲染函数的签名与 import 入口、开关的传法、各文案 key 或数据的位置。P2 包要照着接。
3. 新切点与分布统计（各档占比、四维全同比例、相关系数、每条规则命中率、钳位率）；Fixture A 四维的 raw 与档位。
4. 与方案不一致或自己做了取舍的地方。
5. 改动文件列表；范围外需要配合的事项（含需要升哪些版本号）。
6. 自测结果。没跑的要说明。
