# DestinyOS · Cloudflare 原生交接

主部署平台已确定为 Cloudflare Workers + D1 + KV + R2。资源 ID 与验证命令见 LAUNCH.md。

1. 确认 wrangler 当前账户为 9aea83b326d8175abdd136c1177637a5。
2. 填本地 .dev.vars（Auth、Google、加密 keys、Stripe、Cron 等）；不要提交。邮件通过 EMAIL binding，无邮件 API key。
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

## CF-EMAIL：Owner 发信域名配置

Cloudflare Email Service 的 Email Sending 自 2026 年 4 月公开测试；本次仅改代码和本地验证，未部署、未启用远端服务或修改 DNS。
gavin.pub 已托管在 Cloudflare；Owner 必须在控制台 Compute > Email Service > Email Sending > Onboard Domain 为 **send.gavin.pub** 单独启用发信。
按控制台生成的内容添加/确认 DNS 验证记录：cf-bounce.send.gavin.pub 的 MX 和 SPF TXT、cf-bounce._domainkey.send.gavin.pub 的 DKIM TXT、_dmarc.send.gavin.pub 的 DMARC TXT。
DKIM 公钥和记录值以控制台为准；等待验证完成（通常 5–15 分钟，最长 24 小时），再检查真实发信与收件。
只启用 Email Routing 或只验证 gavin.pub 不等于已启用 send.gavin.pub 的 Email Sending。
Wrangler 已声明 [[send_email]] name="EMAIL"；EMAIL_FROM=noreply@send.gavin.pub、EMAIL_FROM_NAME=天机 DestinyOS 均可配置，换地址时须验证对应发信域名。
向任意用户邮箱发信需要 Workers Paid；当前每账户每月含 3,000 封，超额 $0.35/1,000 封。已验证 destination 的发送免费，不计配额。
新账户每日配额由账户信誉决定，无固定公开数值；单封最多 50 位收件人、主题 998 字符、总大小 5 MiB，触发限制会报错并保留业务重试行为。
本地 Node 开发/测试使用 mock，邮件不会发给外部收件人；E2E 使用 HTTP loopback outbox；未配置 EMAIL 的 Workers 发信会失败，不回退 mock。
订阅提醒按 D1 webhook event.id 锁和 24 小时去重；若发信成功后进程中断，重试可能重复发送（binding 无发送幂等键）。

官方资料：[Workers API](https://developers.cloudflare.com/email-service/api-reference/send/workers/)、[域名与 DNS](https://developers.cloudflare.com/email-service/configuration/domains/)、[子域名](https://developers.cloudflare.com/email-service/configuration/subdomains/)、[限制](https://developers.cloudflare.com/email-service/platform/limits/)、[定价](https://developers.cloudflare.com/email-service/platform/pricing/)。

## WEB-PRICING：月付 + 永久买断

- Owner 定价：USD 2.99/月订阅 + USD 6.99 永久买断；取消年付。
- 配置 STRIPE_PRICE_MONTHLY 与 STRIPE_PRICE_LIFETIME；在正确 test/live 账户运行 `pnpm stripe:products` 并复制输出 ID。脚本归档旧年付价格；已有订阅保留，Portal 需移除年付切换。
- Stripe webhook 增加 checkout.session.async_payment_succeeded，保留 checkout.session.completed、customer.subscription.updated/deleted、invoice.payment_failed；永久买断使用 mode=payment。
- 应用本地已验证的 0005_lifetime_billing.sql（User/Subscription lifetime、Checkout ID 与跨端权益到期字段）；生产迁移与 secrets/发布仍需另行执行。
- REVENUECAT_SECRET_KEY 缺失时跳过同步并记录 warning；配置后需在 RevenueCat 连接 Stripe，并将月付和买断映射 entitlement pro。若 receipt 需要 Stripe app API key，配置 REVENUECAT_STRIPE_API_KEY（服务端保存）。
- RevenueCat webhook URL：/api/v1/mobile/webhooks/revenuecat；启用 integration HMAC signing，将签名 secret 写入 REVENUECAT_WEBHOOK_SECRET。测试、生产 webhook 环境须分别配置。客户端将来以 User.id 作为 app_user_id。
- 买断用户无到期/续费；已有月付在买断后须自行在 Portal 取消旧续费。订阅取消/到期不会降级永久权益。
- 本次不调用真实支付、RevenueCat 账户或生产部署；验收与 DESIGN-GAP 见 docs/progress/WEB-PRICING.md。
