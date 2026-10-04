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
任务：完成 M0-A 的收尾。上一轮实现已落盘（见 docs/progress/M0-A.md），但沙箱禁网导致未安装依赖、未验证、未提交。现在网络与 git 均可用。
要做：
1. 用 corepack 或 npm 安装 pnpm 9（package.json 的 packageManager 字段），`pnpm install` 生成 pnpm-lock.yaml。
2. 依次跑 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm i18n:check`、`pnpm build`，把所有失败修到通过。
3. 启动 `pnpm dev`，用 curl 确认 /zh、/en、/zh/dev/tokens 返回 200 且包含品牌名「天机」，然后关闭 dev server。
4. 添加 .gitignore（node_modules、.next、.turbo、.env.local、test-results、.codex-runs/*.log）。
5. git add -A（排除 .codex-runs/*.log）并提交：`feat: scaffold monorepo, design tokens and i18n (M0-A)`。不要 push。
6. 更新 docs/progress/M0-A.md 的状态、未完成项与验证结果。
只做以上事项，不扩展功能。
