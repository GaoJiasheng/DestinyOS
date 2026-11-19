# 紫微「命盘侧重」试点 · 施工包 P2：网页界面（apps/web）

**工作目录：`/Users/gavin/work/DestinyOS-deploy`**（一个独立的 git worktree，内容与主仓库 `6003242` 一致）。所有改动都在这个目录里做；不要去改 `/Users/gavin/work/DestinyOS`。完成后由主代理把文件搬回主仓库并提交。

背景：Owner 批准了 `docs/progress/SCORING-PROPOSAL-2026-11-16.md` 的全部建议。P1 已经做完计算部分（提交 `6003242`）。先读：方案 §3.2、§5.4、§5.5、§8.3；`docs/systems/ziwei.md` §11；`packages/interpret/src/emphasis/`（`index.ts` 是浏览器可用的入口）；`.codex-runs/ux-fix5-common.md` 的「代码约定」一节。

## P1 提供的契约
```ts
// import from '@tianji/interpret/emphasis'（只含类型与渲染函数，不含求值器和知识库）
type EmphasisLevel = 2 | 3 | 4 | 5;
type EmphasisBasis = { ruleId: string; delta: number; params: Record<string, string> };
type EmphasisDimension = { level: EmphasisLevel; raw: number; basis: EmphasisBasis[] };
type Emphasis = { version: string; dims: Partial<Record<Dim, EmphasisDimension>>; top: Dim[]; omitted: Dim[] };
// Report['headline'].emphasis?: Emphasis
renderEmphasisBasis(basis, locale): string        // 不认识的规则 id 返回 ''，此时这一条不显示
emphasisLevelLabel(level, locale)                 // 突出 / 有支撑 / 平稳 / 多花心思
emphasisDimLabel(dim, locale)
emphasisDimSentence(dim, level, locale)           // 每维每档的一句话
emphasisOverview({ top }, locale, limit = 2)      // 概览句；分享卡传 1
emphasisTitle(locale)                             // 「命盘侧重」
emphasisFootnotes(locale)                         // { disclaimer, health, crossSystem, brightness }
```
计算开关：`interpret({ ..., options: { emphasis: true } })`。不传时报告里没有 `emphasis`。

## 要做的事
1. **开关**：新增 `apps/web/lib/emphasis.ts` 的 `emphasisEnabled()`，读服务端环境变量 `FEATURE_EMPHASIS === 'true'`，默认关闭（上线前要等外部命理顾问签字）。网页端所有「生成或重新生成本命报告」的 interpret 调用点都把它传进 `options.emphasis`（登录用户、匿名用户、「用最新解读重新生成」、导入匿名数据时的重算，逐个确认）。`apps/web/app/api/v1/mobile/**` 和 `apps/web/lib/mobile/**` 不传（App 不在试点范围，不要动它们）。把 `FEATURE_EMPHASIS` 记到 `.env.example`（如果仓库有）和 wrangler 配置的说明里，但**不要**在任何 wrangler 配置或生产环境里把它设为 true。
2. **报告校验放行**：`apps/web/lib/reading-schema.ts` 的 headline 目前会把未知字段剥掉。加上可选的 `emphasis`，按上面的结构严格校验（level 只能是 2–5，dims 的 key 只能是五维之一，basis 条数与字符串长度设合理上限）。匿名本机报告（IndexedDB）读写、分享快照、导出账户数据这几条路径都要能带着它走，逐个确认。
3. **报告页的「命盘侧重」模块**（有 `headline.emphasis` 才显示；没有就完全不出现，旧报告不变）：
   - 标题用 `emphasisTitle`；不出现任何数字、分数、「/5」。
   - 四个维度各一行或一格：维度名 + 档位词 + 一个不带数字的强弱示意（例如四段条或圆点，带等价的无障碍文字）。视觉沿用报告页现有的 token 和组件风格，东方 / 西方主题、深浅色都要能看；手机宽度下不横向滚动；触控区高度 ≥ 44。
   - 概览句（`emphasisOverview`）放在模块顶部。`top` 为空时用它返回的对应变体；返回空串就不显示这一句。
   - 每一维可以展开看依据：先列正向（delta > 0），再列 0，再列负向；每条是 `renderEmphasisBasis` 的一句话，前面可带「+」「−」的方向标记，但不显示数值。负向条目的文案里已经带建议，不要另加评价性文字。展开用仓库现有的折叠或抽屉组件（找 `components/ui`）。
   - 底部脚注：`disclaimer`、`health`、`crossSystem` 三句；`brightness` 放在依据展开区的末尾小字。
   - 这个模块用到的渲染函数和文案（约 23KB JSON）不要进所有报告页的首屏包：只在报告带 `emphasis` 时才加载（`next/dynamic` 或动态 import，带 `loading`，离线时用 `ChunkUnavailable` 兜底，做法见 `components/report/report-layout.tsx` 里现有的懒加载）。`pnpm perf:budgets` 必须仍然通过，不许改预算。
   - 报告页现有的五维雷达逻辑（`components/report/report-utils.ts` 的 `hasScoreSpread`）保持原样：本命报告的 `scores` 仍是全 3，所以继续不显示。不要把侧重画成带数字的雷达。
4. **印刷 / 导出版**（`app/[locale]/[system]/r/[id]/print/`）：报告带 `emphasis` 时在封面或概览处输出同样的四维档位词与概览句、脚注（不需要依据展开；可以每维列最多 3 条依据，放得下再放）。任何情况下都不要出现「x/5」。
5. **分享页与 OG 卡**（`app/s/[token]/page.tsx`、`lib/og-card-render.tsx`）：只带最突出的一维（`top[0]`）及其档位词，或者 `emphasisOverview(..., 1)` 的一句话；`top` 为空就什么都不带。绝不能把 2 档或 3 档的维度公开出去。分享快照里如果存了完整的 `emphasis`，公开接口返回前要裁剪到只剩公开需要的部分（确认公开页的数据里拿不到其余维度和依据）。
6. **切换语言**：同一份报告切到 en / zh-TW 时沿用存下来的 `emphasis`，只重新渲染文案。确认现有的语言切换路径没有丢字段。
7. **文案**：界面自己的固定字（「查看依据」「收起」之类）走 `apps/web/messages/zh.json`、`en.json`（两边都加，key 一致）；规则与档位文案一律用 P1 的渲染函数，不要在 messages 里重复一份。不要手改任何 `zh-TW*` 文件，不要跑 `pnpm i18n:traditional` 和根目录的 `pnpm content:build`。客户端文案要确认对应的 `ClientMessages` 子集包含新 key。
8. **测试**：
   - vitest：模块渲染（Fixture A：事业 有支撑、财富 多花心思、感情 平稳、人际 有支撑；概览句「你的盘面侧重在事业与人际。」以 P1 的实际输出为准）、依据排序、没有 `emphasis` 时不渲染、schema 校验（合法与非法各几例）、分享数据裁剪、开关关闭时调用点不传。
   - e2e：新增 `playwright.emphasis.config.ts`（参照 `playwright.offline-report.config.ts` 的写法：独立的 spec，webServer 的 env 里设 `FEATURE_EMPHASIS=true`；并在根 `playwright.config.ts` 里忽略这份 spec）和 `apps/web/e2e/emphasis.spec.ts`：匿名用户用档案 A（1990-05-15 08:30 北京，男）排紫微盘 → 看到模块与四个档位词 → 展开一维看到依据 → 切到英文仍然显示且档位一致 → 页面文本里不含「/5」；登录用户生成并分享 → 公开分享页只出现最突出的一维。根 `package.json` 加 `test:emphasis:e2e`。
   - 回归：`pnpm build` 后跑 `playwright.ziwei.config.ts`、`playwright.readings.config.ts`、`playwright.export.config.ts` 和默认配置，确认开关关闭时没有任何变化（截图基线不应该变；变了说明关闭状态下有泄漏，要修而不是更新基线）。
9. **截图给主代理审**：用开关打开的服务，把档案 A 的紫微报告页截图存到 `/private/tmp/claude-501/-Users-gavin-work-DestinyOS/e8b888ca-57d2-4d05-ae87-02f4253da4f6/scratchpad/emphasis-shots/`：桌面 1280 宽与手机 390 宽各一张模块特写（收起）和一张展开一维的；英文一张；印刷版一张；分享页一张。文件名说明内容。
10. **字体**：规则文案里的字是否都在网页字体子集里，查一下现有的检查方式（仓库有审计 WOFF2 cmap 的脚本或测试，grep `cmap`、`font corpus`）。缺字需要重新生成字体语料的话，不要自己跑，在汇报里写明缺哪些字、该跑什么。

## 文件范围
- 可改：`apps/web/**`（除 `app/api/v1/mobile/**`、`lib/mobile/**`、任何 `zh-TW*` 文件）、根目录的 `playwright.emphasis.config.ts`（新）、`playwright.config.ts`（只加忽略项）、根 `package.json`（只加一条脚本）。
- 不要改：`packages/**`（P1 的产物；发现问题在汇报里写，不要改）、`apps/mobile/**`、版本号文件、perf 预算、eslint / tsconfig 配置。

## 禁止
任何 git 写操作（commit / stash / checkout / reset / add / merge）、部署（wrangler、`pnpm cf:*`）、安装或升级依赖、数据库 schema 迁移。可以在本目录 `pnpm build`、启动测试服务、跑 playwright。跑完把你启动的服务都停掉。

## 自测
仓库根目录：`npx vitest run apps/web`（至少相关文件）、`npx eslint <你改的文件>`、`npx prettier --write <你改的文件>`、`cd apps/web && npx tsc --noEmit -p .`、`pnpm perf:budgets`（需要先 build）、上面列的 e2e。

## 汇报（中文，1000 字以内）
1. 逐条（1–10）：已做 / 部分（剩什么）/ 未做（原因）。
2. 开关接到了哪些调用点（文件:行），哪些路径故意没接。
3. 公开分享数据里最终包含哪些侧重字段。
4. 新增文案 key；新增或改动的文件列表（含 e2e 快照）。
5. 包体积变化（perf:budgets 里报告页与首页的数字，前后对比）。
6. 自测结果；没做或拿不准的地方；需要主代理配合的事项。
