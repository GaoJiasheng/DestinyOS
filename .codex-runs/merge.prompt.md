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
任务：合并分支。把环境变量 BRANCHES 中列出的分支（空格分隔，已在本地）逐个 merge 进当前分支 main。冲突时保留双方功能并修正，package.json 依赖合并后重新 `pnpm install` 更新 lockfile。合并后运行 `pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate 2>/dev/null; pnpm build`，把失败修到通过。每个分支一次 merge commit，最后如有修复再提交 `chore: post-merge fixes`。不要 push。合并完成后把各分支的 docs/progress/*.md 保留。另外：若 docs/04-engine-overview.md §9 的 Fixture F 仍写 1992 年闰六月，请改为「农历 1993 年闰三月十五 06:00，成都」（1993 年确有闰三月），并同步 packages/engine/test/fixtures 中的 F。
BRANCHES=wt/t33 wt/t34 wt/t35 wt/t36 wt/t37
