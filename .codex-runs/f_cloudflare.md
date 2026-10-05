任务：Cloudflare 部署适配（保留 Vercel 路径，两个平台都能部署）。
阅读：docs/09-architecture.md；LAUNCH.md；apps/web/vercel.json；导出、cron、blob、日志、Prisma、聊天流式相关代码。
要做：
1. 用 @opennextjs/cloudflare 让 apps/web 可构建为 Cloudflare Workers：open-next.config.ts、wrangler.toml（name destinyos、compatibility_date 最新、nodejs_compat、assets、R2 绑定 EXPORT_BUCKET、Browser Rendering 绑定 BROWSER、Cron Triggers 每日 03:00 UTC、环境变量与 secrets 清单注释）；`pnpm cf:build`、`pnpm cf:preview`、`pnpm cf:deploy` 脚本。
2. 平台抽象层 apps/web/lib/platform/：存储（Vercel Blob | R2）、浏览器渲染（本地/Vercel Playwright | Cloudflare Browser Rendering REST/binding 用 @cloudflare/puppeteer）、定时任务入口（Vercel Cron 路由 | Workers scheduled handler 调用同一函数）、日志（pino | Workers 兼容的轻量 JSON logger）；按环境变量 `PLATFORM=vercel|cloudflare` 选择，默认自动检测。
3. Prisma 在 Workers 用 @prisma/adapter-neon（HTTP/WebSocket）与 driverAdapters 预览特性；Auth.js、Upstash REST、Resend、Stripe webhook（原始 body 读取）、@vercel/og（改用 next/og 或 satori 直接）在 Workers 下验证可用；MiniMax 流式输出在 Workers 下验证可用；PDF/PNG 导出在 Browser Rendering 下验证页数与字体（字体需作为静态资源可被 Browser Rendering 访问）。
4. 本地用 wrangler dev 跑通：首页、八字报告、每日运势、追问大师（有 key）、导出（Browser Rendering 本地不可用则用 mock 并说明）。
5. 更新 LAUNCH.md 为两种平台的部署说明（Cloudflare：Workers Paid 计划、R2、Browser Rendering 配额、Cron Triggers、secrets 命令 `wrangler secret put`、域名 tianji.gavin.pub 绑定、Neon 与 Upstash 区域建议），并更新 .env.example。
6. 测试与 CI：平台抽象层单测；CI 增加 cf:build 作业（不部署）。
