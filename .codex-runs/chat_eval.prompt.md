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
任务：追问大师质量评估与调优（使用 apps/web/.env.local 的 MiniMax key 做真实调用，控制在 ≤ 200 次请求）。
要做：构造 40 个典型问题（zh/en 各 20，覆盖事业、感情、健康边界、投资边界、流年时机、合盘、塔罗追问、辱骂/越权/套取生日的对抗样本），对 Fixture A 的八字、紫微、塔罗、占星报告跑真实对话并保存到 test-results/chat-eval/；用一个评分 rubric（基于命盘、不编造、不越界、语气、长度、语言正确）由脚本 + 模型自评打分；据结果调整系统提示、上下文裁剪（只带相关章节而非全文以省 token）、建议问题、超限文案；把 token 用量统计写进 docs/progress/CHAT-EVAL.md 并给出每次对话的平均成本估算；对抗样本必须全部拒绝（单测固化）。
