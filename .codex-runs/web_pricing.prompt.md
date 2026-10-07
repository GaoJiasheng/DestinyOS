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
任务：Web 端定价改为两档（Owner 决定）：去广告 2.99 美元/月订阅 + 6.99 美元永久买断（一次性付款，Stripe Checkout mode=payment）；取消年付。更新 Stripe 产品创建脚本、/pricing 页、/me/billing、webhook（checkout.session.completed 的一次性付款也授予 plan=pro 且永久，不随订阅事件降级）、User/Subscription 模型（新增 lifetime 标记）、文案 zh/zh-TW/en、docs/11-ads-and-billing.md 与 LAUNCH/MORNING。为跨端预留：在 webhook 处理后调用 RevenueCat REST API 同步该用户的 Stripe 购买（REVENUECAT_SECRET_KEY 缺失时跳过并记录），并新增 POST /api/v1/mobile/webhooks/revenuecat 占位路由（验签、幂等，按 entitlement pro 更新 plan）。测试全部通过，提交。
