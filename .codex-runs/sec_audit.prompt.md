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
任务：安全审计与修复。角色：渗透测试工程师。
阅读：docs/08-security-privacy.md 全文；docs/07-api.md §1–§2。
要做：审计并修复：认证流程（魔法链接重放、会话固定、OAuth state）、字段加密实现（IV 重用、AAD、密钥轮换脚本）、授权（IDOR：读取/删除他人报告与分享、admin 路由、cron 路由鉴权）、限流绕过、分享 token 熵与枚举、公开页与 OG 图是否泄露生日、日志与 Sentry 脱敏实测、CSP 与安全头、Zod 校验遗漏、SSRF/路径穿越（城市库、导出、图片生成）、依赖漏洞（pnpm audit）、Stripe webhook 验签与幂等、Prisma 原始查询注入、匿名本地存储加密。每个发现写入 docs/progress/SECURITY-AUDIT.md（严重度、位置、修复、验证方法），并为每个高危项补一条回归测试。
