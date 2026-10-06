# DestinyOS · Cloudflare 原生交接

主部署平台已确定为 Cloudflare Workers + D1 + KV + R2。资源 ID 与验证命令见 LAUNCH.md。

1. 确认 wrangler 当前账户为 9aea83b326d8175abdd136c1177637a5。
2. 填本地 .dev.vars（Auth、Google、Resend、加密 keys、Stripe、Cron 等）；不要提交。
3. `pnpm install && pnpm db:migrate`，D1 SQL 来源 apps/web/migrations/。
4. `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm test:e2e`、`pnpm cf:build`。
5. `pnpm cf:smoke` 启动本地 wrangler dev；另一个终端运行 `pnpm test:cloudflare:e2e`。
6. 远端 schema 使用 `pnpm db:remote`；本次已执行远端迁移，重复执行会跳过已应用版本。
7. Owner 配置真实 Worker secrets 与公开构建变量后，另行授权发布、配置域名与 OAuth redirect。

本次不发布 Worker、不写生产 secrets、不 push。Vercel 托管部署已退出验收范围；本地 Node renderer/storage 继续支持测试。

D1 不支持 Prisma 交互事务 ACID；业务更新使用原子 SQL 或 DB.batch，不能把旧事务调用重新放回生产路径。
KV 仅用于最终一致的缓存与近似分享计数；token、webhook 幂等、聊天配额和限流小时维度在 D1。
加密字段格式与每用户 AES-GCM key derivation 保持不变；FIELD_ENCRYPTION_KEYS 需由 Owner 提供真实值。
Browser Rendering 本地不可用时使用测试 renderer mock，生产验收需要检查实际 Browser/R2 配额。

若旧数据库中已有真实数据，先备份并独立导入 D1；本任务没有访问旧用户数据。历史 prisma/migrations/ 不用于 D1。
