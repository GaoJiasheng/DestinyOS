# f_cloudflare — Cloudflare 部署适配

## 完成项

- 保留 Vercel 部署、Blob、Playwright、pino、原生 Prisma；增加 OpenNext Workers 构建与 cf:build/preview/deploy。
- Wrangler 配置 destinyos、nodejs_compat、ASSETS、私有 EXPORT_BUCKET、BROWSER、R2 增量缓存及每日 03:00 UTC Cron。
- 平台按 PLATFORM 或运行时自动选择；两端复用维护函数、权限、配额、导出缓存键与 24h 过期规则。
- Workers 使用 Prisma Neon WebSocket adapter、请求隔离与流结束清理；生成关系元数据，保持嵌套字段加密。
- Stripe 使用原始 body 异步验签，OG 改 next/og；Workers 通过 Assets 读取语料、字体和原 geo-tz 边界数据。
- Browser Rendering 支持 A4 PDF、逐页 PNG、分页/字体验证、同源限制；PNG 像素不变且标记 300dpi。
- 轻量 JSON 日志复用脱敏；构建移除服务端 env 默认值，避免将 .env.local 密钥打包；解决每日 Worker 双重压缩。
- 更新 LAUNCH.md、.env.example、CI Cloudflare 构建/dry-run；增加平台单测、Wrangler 双语 E2E 与隔离 SDK 探针。

## 未完成项 / 验收边界

- 未部署、未绑定域名；本任务提供两种部署路径，CI 不部署。
- 缺真实 Neon/Upstash/Google/Resend 服务凭据：云端事务、OAuth 重登、邮件投递仍待验收。
- MiniMax 实际 key 的 workerd 流式调用通过；缺付费账户/Neon，完整已登录“追问大师”页面流程未验收。
- Browser 绑定为 Wrangler 本地真实 Chromium；云端配额、HTTPS 源与完整八体系 Browser Rendering 导出仍待部署后复验。

## DESIGN-GAP 列表

- 使用当前 workerd 支持的最新 UTC 日期 2026-10-05（本地已是 10-06）。
- OpenNext 构建前编译完整语料；公共字体/语料放 Assets，geo-tz 原始边界按 4MiB 切片，保持精确规则。
- Workers 无 Prisma.dmmf：生成静态关系元数据；Neon WebSocket 支持交互事务，Node 保持原生驱动。
- 仅 AsyncLocalStorage 容器全局共享，连接按请求隔离，保留至流完成并断开。
- scheduled 通过内部 OpenNext fetch 建立上下文并进入同一维护路由，不走公开网络。
- Cloudflare 构建排除 Node 原生模块；生成模块提供明确声明，不使用 any/ts-ignore。
- Workers 保留 Chromium 无损 PNG，只重写物理分辨率；不调用原生 sharp。
- 服务端 env 默认值从 OpenNext 产物剥离；Workers Assets 接管压缩，构建展开 Brotli Worker 副本。
- 新 Cloudflare 包双许可证 MIT OR Apache-2.0 均为原有允许项；未引入 GPL/AGPL。
- 隔离 loopback Redis REST 与 SDK/字体探针不进入生产 Worker；缺外部凭据不伪造真实服务通过。
- 原有无 Blob 时私有临时目录、打印舍入容差等既有 DESIGN-GAP 保留。

## 如何验证

- 实际 pnpm install、pnpm lint、pnpm typecheck、pnpm test；85 文件 / 3565 项通过。
- 实际 pnpm cf:build 与 wrangler deploy --dry-run 通过；压缩 Worker 9180.18 KiB，密钥扫描通过。
- 实际 pnpm build 通过（保留 Vercel 路径，2408 静态页）；security:policy 通过。
- pnpm test:export:e2e：5 项通过，涵盖中英八体系完整 PDF/PNG、所有权、会员、缓存、配额及下载进度。
- pnpm licenses:check 通过；TypeScript strict，无 any 逃逸。
- pnpm cf:preview（wrangler dev）+ pnpm test:cloudflare:e2e：中英首页→匿名完整八字→每日运势/日期切换，2 项通过。
- 隔离 workerd：MiniMax 真实 delta/usage、R2、Upstash REST mock、Resend mock、Stripe 原始 body WebCrypto 验签通过。
- 双语 next/og 实际返回 PNG；Browser binding 实际三页 A4 PDF，Noto/Cormorant 嵌入，PNG 2480×3508/300dpi。
- SDK 探针、Redis mock 与本地 secrets 命令见 LAUNCH.md；.dev.vars 不入 Git。
