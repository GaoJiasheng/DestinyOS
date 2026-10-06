# DestinyOS · Cloudflare 原生上线清单

主平台为 Cloudflare Workers（OpenNext）。D1、KV、R2 均使用原生 binding，无 Neon、Upstash 或数据库连接 secrets。

## 已创建资源

| Binding                  | 资源                                                |
| ------------------------ | --------------------------------------------------- |
| DB                       | destinyos / 7d4b2c61-d7dd-412f-a84e-89eb184378cc    |
| CACHE                    | destinyos-cache / 0db59c62dc5e4e85a9e1ae5eed33693f  |
| EXPORT_BUCKET            | destinyos-exports                                   |
| NEXT_INC_CACHE_R2_BUCKET | destinyos-next-cache                                |
| RATE_LIMITER             | namespace_id=1001，200/60s 突发；小时维度由 D1 实现 |
| BROWSER                  | Browser Rendering（生产 PDF/PNG 导出）              |
| EMAIL                    | Email Service send_email（send.gavin.pub 发信域名） |

Account ID：9aea83b326d8175abdd136c1177637a5。配置见 apps/web/wrangler.toml。

## 本地验证

```bash
pnpm install
pnpm db:deploy
pnpm db:migrate
pnpm content:build
pnpm content:import
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm cf:build
pnpm cf:smoke
# 另一个终端；真实 Worker 首页、表单与缓存验证
pnpm test:cloudflare:e2e
```

`pnpm db:deploy` 只写本地 SQLite；`pnpm db:migrate` 应用 Wrangler 本地 D1 迁移。
`pnpm cf:build` 只构建与本地 gzip 体积检查（≤10MiB），不部署。
本地秘密放 apps/web/.dev.vars，不提交；变量清单见 .env.example。

## 发布前由 Owner 配置

Auth.js、Google OAuth、FIELD_ENCRYPTION_KEYS、Stripe、CRON_SECRET 等真实密钥通过 Workers Secrets 配置。
NEXT_PUBLIC_* 为构建期公开配置；EMAIL_FROM、EMAIL_FROM_NAME、ADMIN_EMAILS、Stripe price IDs、法律控制者与联系方式使用实际值。
邮件使用 EMAIL binding，无邮件 API key；默认发信地址 noreply@send.gavin.pub，显示名「天机 DestinyOS」。
Owner 先在 Cloudflare Email Service > Email Sending 为 send.gavin.pub 启用发信并验证 DNS，步骤、限制与定价见 MORNING.md。

D1 使用 `pnpm db:remote` 应用已经本地验证的 SQL；禁止生产 db push。
Worker 发布与生产 secrets 写入需要单独授权，本次任务不执行。域名为 tianji.gavin.pub。
Browser Rendering 需要可用生产配额；本地不可用时仅测试 renderer mock 与私有 R2 存取。
Cloudflare scheduled 每日 03:00 UTC 清理过期状态、撤销过期分享、硬删除账户并聚合事件。

旧 PostgreSQL 历史迁移不再执行；若旧 Neon 存在真实用户数据，需独立脱敏导入与数量核对后再切流。
本次未提供旧数据 dump，未搬运用户数据。

本次验收结果与 DESIGN-GAP 见 docs/progress/CF-NATIVE.md；交接见 MORNING.md。

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
