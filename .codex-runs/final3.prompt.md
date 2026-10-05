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
任务：上线前全面打磨与验收（对应 T-64 与 docs/01-prd.md §7、docs/08 §7）。
要做：
1. 跑全部检查：pnpm lint、typecheck、test、content:validate、i18n:check、build、test:e2e（本地 dev server）、Lighthouse CI（移动端首页/today/八字报告 Performance ≥ 85、Accessibility ≥ 90）。失败全部修复。
2. 逐条核对 docs/01-prd.md §7 验收清单与 docs/08 §7 安全清单，能自动验证的写成脚本 scripts/launch-check.ts，输出通过/未通过。
3. 用 Fixture A 在七个体系生成报告，检查字数达标（docs/05 §7 运行时要求）、无 {{ 占位符、无禁用词、zh/en 无残留；修复知识库缺口。
4. 检查 `vercel whoami`：若已登录且 `vercel link` 可用，创建 Vercel 项目并部署 Preview，把 URL 写入 LAUNCH.md；否则在 LAUNCH.md 写明 Owner 需要手动完成的步骤：Vercel Pro 项目与域名 tianji.gavin.pub、Neon、Upstash、Resend、Google OAuth consent（切 production）、Stripe 产品/价格/webhook、AdSense 申请与 Privacy & messaging 配置、环境变量清单（含如何生成 FIELD_ENCRYPTION_KEYS）、首次 `prisma migrate deploy` 与 `content:import`。
5. 更新根 README.md 与 docs/progress/SUMMARY.md：所有任务状态、已知问题、DESIGN-GAP 汇总。
6. 提交。
