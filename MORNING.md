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

## WEB-PRICING：保留的月付 + 永久买断（当前关闭）

- Owner 定价：USD 2.99/月订阅 + USD 6.99 永久买断；取消年付。
- 配置 STRIPE_PRICE_MONTHLY 与 STRIPE_PRICE_LIFETIME；在正确 test/live 账户运行 `pnpm stripe:products` 并复制输出 ID。脚本归档旧年付价格；已有订阅保留，Portal 需移除年付切换。
- Stripe webhook 增加 checkout.session.async_payment_succeeded，保留 checkout.session.completed、customer.subscription.updated/deleted、invoice.payment_failed；永久买断使用 mode=payment。
- 应用本地已验证的 0005_lifetime_billing.sql（User/Subscription lifetime、Checkout ID 与跨端权益到期字段）；生产迁移与 secrets/发布仍需另行执行。
- REVENUECAT_SECRET_KEY 缺失时跳过同步并记录 warning；配置后需在 RevenueCat 连接 Stripe，并将月付和买断映射 entitlement pro。若 receipt 需要 Stripe app API key，配置 REVENUECAT_STRIPE_API_KEY（服务端保存）。
- RevenueCat webhook URL：/api/v1/mobile/webhooks/revenuecat；启用 integration HMAC signing，将签名 secret 写入 REVENUECAT_WEBHOOK_SECRET。测试、生产 webhook 环境须分别配置。客户端将来以 User.id 作为 app_user_id。
- 买断用户无到期/续费；已有月付在买断后须自行在 Portal 取消旧续费。订阅取消/到期不会降级永久权益。
- 本次不调用真实支付、RevenueCat 账户或生产部署；验收与 DESIGN-GAP 见 docs/progress/WEB-PRICING.md。

## WEB-NOPAY：App 开通与费用保护

- 默认 `FEATURE_WEB_PAYMENTS=false`，网站暂不收款，无需 Stripe secrets/price IDs；上面的 Stripe 操作仅供未来开启。设置构建公开变量 `NEXT_PUBLIC_APP_STORE_URL`、`NEXT_PUBLIC_PLAY_STORE_URL`；空值显示即将上架。
- 配置 RevenueCat 两个 App 产品映射 `pro`；App 使用网站 `User.id` 登录 SDK。Worker secrets 配置 `REVENUECAT_SECRET_KEY`、`REVENUECAT_WEBHOOK_SECRET`，Dashboard 开启 HMAC signing；Webhook 地址 `/api/v1/mobile/webhooks/revenuecat`。网页登录后可刷新会员，未配置 REST key 跳过。
- 费用检查：Owner 将有 Account Analytics Read 权限的 `CLOUDFLARE_API_TOKEN` 同值存为 Worker secret：`cd apps/web && pnpm exec wrangler secret put CF_ANALYTICS_TOKEN`（通过提示输入，不写入文件）。配置 `ADMIN_EMAILS`、`CF_ANALYTICS_ACCOUNT_ID`、实际账单周年日 `CF_BILLING_CYCLE_DAY`；验证 Email Service 真正可发告警。
- Cron 每小时查询账户本计费月 Workers 用量；任一超过 90% 熔断，均低于 80% 或新周期恢复；每日清理并存。`/admin/config` 的费用熔断模式可手动开/关及切回自动。KV 的 circuit/state/mode 为持久状态，切勿给 circuit 设置过期时间。
- CPU 限额 5000ms：本地实际图片 Route Handler 最慢分享 story P99 742.541ms，三倍 2227.623ms，取 Owner 指定的 5000ms 下限；样本范围见 docs/11 §4，发布后按生产 CPU P99 复核 `max(5000, ceil(P99×3))`。Analytics/KV 有延迟且维护请求仍可能计费，此保护不是 Cloudflare 硬性消费封顶。
- WAF **本任务未执行**。Owner 在根目录运行 `pnpm exec tsx scripts/cf-waf-ratelimit.ts --dry-run` 审阅规则（无 token、无 API 调用），再在已设置 `CLOUDFLARE_API_TOKEN` 的终端运行 `pnpm exec tsx scripts/cf-waf-ratelimit.ts`。令牌需 gavin.pub 的 Zone Read 与 Zone WAF Edit 权限；禁止写入仓库或命令行明文。
- 脚本定位 gavin.pub、按 ref 幂等追加/更新自己的规则，保留其他规则；阻断 tianji.gavin.pub IP 60/10s，持续 60s，排除静态路径；按 Cloudflare 边缘位置计数。若套餐不支持 60 秒 mitigation，Owner 升级/调整套餐后重跑，不静默放宽。
- 未部署、未写远端 secrets、未调用真实商店或支付；验证结果与 DESIGN-GAP 见 docs/progress/WEB-NOPAY.md。
