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
任务：Cloudflare 部署适配（保留 Vercel 路径，两个平台都能部署）。
阅读：docs/09-architecture.md；LAUNCH.md；apps/web/vercel.json；导出、cron、blob、日志、Prisma、聊天流式相关代码。
要做：
1. 用 @opennextjs/cloudflare 让 apps/web 可构建为 Cloudflare Workers：open-next.config.ts、wrangler.toml（name destinyos、compatibility_date 最新、nodejs_compat、assets、R2 绑定 EXPORT_BUCKET、Browser Rendering 绑定 BROWSER、Cron Triggers 每日 03:00 UTC、环境变量与 secrets 清单注释）；`pnpm cf:build`、`pnpm cf:preview`、`pnpm cf:deploy` 脚本。
2. 平台抽象层 apps/web/lib/platform/：存储（Vercel Blob | R2）、浏览器渲染（本地/Vercel Playwright | Cloudflare Browser Rendering REST/binding 用 @cloudflare/puppeteer）、定时任务入口（Vercel Cron 路由 | Workers scheduled handler 调用同一函数）、日志（pino | Workers 兼容的轻量 JSON logger）；按环境变量 `PLATFORM=vercel|cloudflare` 选择，默认自动检测。
3. Prisma 在 Workers 用 @prisma/adapter-neon（HTTP/WebSocket）与 driverAdapters 预览特性；Auth.js、Upstash REST、Resend、Stripe webhook（原始 body 读取）、@vercel/og（改用 next/og 或 satori 直接）在 Workers 下验证可用；MiniMax 流式输出在 Workers 下验证可用；PDF/PNG 导出在 Browser Rendering 下验证页数与字体（字体需作为静态资源可被 Browser Rendering 访问）。
4. 本地用 wrangler dev 跑通：首页、八字报告、每日运势、追问大师（有 key）、导出（Browser Rendering 本地不可用则用 mock 并说明）。
5. 更新 LAUNCH.md 为两种平台的部署说明（Cloudflare：Workers Paid 计划、R2、Browser Rendering 配额、Cron Triggers、secrets 命令 `wrangler secret put`、域名 tianji.gavin.pub 绑定、Neon 与 Upstash 区域建议），并更新 .env.example。
6. 测试与 CI：平台抽象层单测；CI 增加 cf:build 作业（不部署）。
