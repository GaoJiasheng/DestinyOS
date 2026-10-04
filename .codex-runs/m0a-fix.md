任务：完成 M0-A 的收尾。上一轮实现已落盘（见 docs/progress/M0-A.md），但沙箱禁网导致未安装依赖、未验证、未提交。现在网络与 git 均可用。
要做：
1. 用 corepack 或 npm 安装 pnpm 9（package.json 的 packageManager 字段），`pnpm install` 生成 pnpm-lock.yaml。
2. 依次跑 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm i18n:check`、`pnpm build`，把所有失败修到通过。
3. 启动 `pnpm dev`，用 curl 确认 /zh、/en、/zh/dev/tokens 返回 200 且包含品牌名「天机」，然后关闭 dev server。
4. 添加 .gitignore（node_modules、.next、.turbo、.env.local、test-results、.codex-runs/*.log）。
5. git add -A（排除 .codex-runs/*.log）并提交：`feat: scaffold monorepo, design tokens and i18n (M0-A)`。不要 push。
6. 更新 docs/progress/M0-A.md 的状态、未完成项与验证结果。
只做以上事项，不扩展功能。
