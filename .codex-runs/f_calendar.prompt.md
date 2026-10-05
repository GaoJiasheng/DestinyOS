你是 DestinyOS（天机）项目的施工工程师。仓库根目录的 docs/ 是唯一需求来源，先读 docs/00-overview.md 全文，再读任务指定的文档节。
通用约束：
- 技术栈与目录结构严格按 docs/09-architecture.md；枚举值、字段名、路由、文案键以文档为准，不得更名。
- 不引入 AGPL/GPL 依赖。TypeScript strict，禁止 any 逃逸。
- 用户可见文案一律经 next-intl，zh 与 en 必须同时提供。
- 文档未覆盖的细节选最主流做法，并在代码中加 `// DESIGN-GAP: <说明>` 注释。
- 不要修改 docs/ 目录（除非任务明确要求）。不要动 .codex-runs/。
- 完成后必须实际运行 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（若有）、`pnpm build`，全部通过才算完成；把失败修到通过。
- 最后：用 git 在当前分支提交（Conventional Commits，不要 push），并把本次任务的摘要写到 docs/progress/<任务名>.md：完成项、未完成项、DESIGN-GAP 列表、如何验证。摘要控制在 60 行内。
- 全程不要询问，自行决策。网络可用，可以安装 npm 包。
任务：运势日历（docs/14 B-06）。
要做：/[locale]/today/calendar 月视图热力图（按每日总评着色，金色系），点日期进入该日运势（复用 getDailyAction），月切换；年度重要日期列表：二十四节气、大运交接与流年切换（八字）、大限/流年切换（紫微）、水逆/金逆/火逆区间、新月满月、日月食、个人太阳回归日、Mahadasha/Antardasha 切换（吠陀）——全部由引擎计算，缓存按用户+年；每条有一句话解释与跳转。批量计算性能：一个月 ≤ 400ms（服务端），用 getDailyRangeAction。测试与 E2E。
