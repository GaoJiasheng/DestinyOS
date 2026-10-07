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
| EMAIL                    | Email Service send_email（mail.gavin.pub 发信域名） |

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
邮件使用 EMAIL binding，无邮件 API key；默认发信地址 noreply@mail.gavin.pub，显示名「天机 DestinyOS」。
Owner 先在 Cloudflare Email Service > Email Sending 为 mail.gavin.pub 启用发信并验证 DNS，步骤、限制与定价见 MORNING.md。

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

## T-64 复验与 Owner 手动交接（2026-10-07）

`pnpm dlx vercel@latest whoami`（CLI 62.7.0）实际返回 `Logged out`；未 link、未创建项目、无 Preview URL。
按 docs/09 的 CF-NATIVE 补充，托管 Vercel 不再是当前生产验收路径；以下保留任务要求的历史服务交接，避免混用两套架构。

1. **当前生产路径**：Owner 核对 Cloudflare 资源与域名 `tianji.gavin.pub`，配置下面的 secrets/公开变量；本地 `pnpm db:deploy`、`pnpm db:migrate`、`pnpm content:import` 后运行完整验收和 `pnpm cf:build`。远端首次迁移为 `pnpm db:remote`；通过管理员内容发布/签名 Release 导入生产，确认 `/api/v1/health` 的版本与本地一致。`content:import` 默认只写本地 SQLite，不会自动导入远端 D1。
2. **Vercel Pro 备选**：Owner `pnpm dlx vercel login` → `pnpm dlx vercel link` 创建/选择 Pro 项目，Root Directory=`apps/web`，开启访问根目录工作区源文件；Preview 单独配置 origin/OAuth 回调。执行 `pnpm dlx vercel` 得到 Preview，验收后再绑定域名。当前 Node SQLite/邮件 mock 是开发后备，无法保证 Vercel serverless 持久化和真实发信，因此不能直接切生产。
3. **Neon / Upstash（历史路线）**：如 Owner 另行决定恢复该架构，创建同区域 Neon 项目（pooled 应用连接与 direct 迁移连接），创建 Upstash Redis，私存连接 URL/REST token。必须先恢复匹配 PostgreSQL 的 schema、adapter、服务实现与版本化迁移，再执行首次 `pnpm exec prisma migrate deploy` → `pnpm content:import`。当前 schema 为 SQLite，历史 migration lock 为 PostgreSQL，禁止直接运行该组合到生产；不能仅填入旧 `DATABASE_URL` 就声称已迁移。
4. **Resend（历史路线）**：Owner 验证发信域名的 SPF/DKIM，生成限定发信域名的 API key，恢复对应邮件 adapter 后私存 `RESEND_API_KEY` / 配置 `EMAIL_FROM`。当前生产使用 Cloudflare `EMAIL` binding；Node 只允许隔离 loopback mock，填 Resend key 不会启用它。
5. **Google OAuth**：在 Google Auth Platform 核对 Branding、授权域 `gavin.pub`、公开首页/zh/en 隐私和条款 URL；Audience → Publish app 切 **In production**，按后台要求完成验证。只请求 email/profile；Web 回调为 `/api/auth/callback/google`，原生 client ID 配置至 mobile audience。实际测试 Google 登录、删除、7 天硬删除后重登新用户；不能用 mock 替代这项。
6. **Stripe（未来显式开启）**：保持 `FEATURE_WEB_PAYMENTS=false`。开启前在 test/live 账户分别创建月付 USD 2.99 与永久 USD 6.99（`pnpm stripe:products`），设置 monthly/lifetime price 和 webhook secret。Webhook `/api/v1/stripe/webhook` 事件为 checkout.session.completed、checkout.session.async_payment_succeeded、customer.subscription.updated/deleted、invoice.payment_failed；配置 Portal、签名重放/退款/取消到期验收后再开关。年付已取消；App 内购见 docs/app/RELEASE.md。
7. **AdSense**：添加 `tianji.gavin.pub`、验证所有权/ads.txt、提交审核；把真实 publisher/slot IDs 放公开变量。Privacy & messaging 发布欧洲法规与美国州法消息；测试允许、拒绝、撤回、未知年龄非个性化与会员无广告。公开前填真实运营主体和联系方式；观察实际 CSP 报告后无违规再 enforce。

8. **告警与恢复演练**：配置 Web/App 的 Sentry 项目、脱敏测试事件及告警收件人，确认通知送达。数据库密文与 FIELD_ENCRYPTION_KEYS 分开备份；在隔离库恢复并核验旧报告解密、删除状态和令牌撤销。当前 D1 使用 [Time Travel/导出备份](https://developers.cloudflare.com/d1/reference/time-travel/)，Owner 记录恢复点、实际套餐保留期与演练结果；历史 Neon 路线则验证其备份恢复。
9. **回滚**：保存 Git SHA、Worker 版本、知识 Release 与迁移版本。按 [Worker 回滚](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) 在隔离环境核验旧代码与当前 schema/密钥/语料兼容，再回滚生产；代码回滚不等于数据库回滚。正式切换前完成双语 health、报告、登录与删除 smoke，保留可复查记录。

### 当前环境变量与密钥

完整逐项清单为根 `.env.example`；不把 secret 写入 `NEXT_PUBLIC_*` 或提交到 Git。

| 组           | 变量 / binding                                                                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 平台         | `DB`、`CACHE`、`RATE_LIMITER`、`EXPORT_BUCKET`、`NEXT_INC_CACHE_R2_BUCKET`、`BROWSER`、`EMAIL`、`ASSETS`；`PLATFORM`；本地 `LOCAL_DATABASE_URL`                                                                                                                                       |
| 鉴权与加密   | `AUTH_SECRET`、`AUTH_URL`、`AUTH_TRUST_HOST`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`FIELD_ENCRYPTION_KEYS`、`ADMIN_EMAILS`、`CRON_SECRET`                                                                                                                                          |
| 邮件与法律   | `EMAIL_FROM`、`EMAIL_FROM_NAME`、`PRIVACY_CONTROLLER_NAME`、`PRIVACY_CONTACT_EMAIL`                                                                                                                                                                                                   |
| 公开构建     | `NEXT_PUBLIC_SITE_URL`、`NEXT_PUBLIC_DEFAULT_LOCALE`、`NEXT_PUBLIC_ADSENSE_CLIENT`、`NEXT_PUBLIC_ADSENSE_SLOT_{HOME,REPORT_TOP,REPORT_BOTTOM,TODAY,LEARN}`、`NEXT_PUBLIC_APP_STORE_URL`、`NEXT_PUBLIC_PLAY_STORE_URL`                                                                 |
| 支付（可选） | `FEATURE_WEB_PAYMENTS`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_MONTHLY`、`STRIPE_PRICE_LIFETIME`、`STRIPE_TAX_ENABLED`                                                                                                                                           |
| 移动端与权益 | `MOBILE_GOOGLE_CLIENT_IDS`、`MOBILE_APPLE_CLIENT_IDS`、`MOBILE_KNOWLEDGE_PUBLIC_KEY`、`MOBILE_KNOWLEDGE_KEY_ID`、`MOBILE_ANDROID_CERT_SHA256`、`REVENUECAT_SECRET_KEY`、`REVENUECAT_STRIPE_API_KEY`、`REVENUECAT_WEBHOOK_AUTHORIZATION`；自定义 HMAC 才用 `REVENUECAT_WEBHOOK_SECRET` |
| 监控与开关   | `SENTRY_DSN`、`NEXT_PUBLIC_SENTRY_DSN`、`FEATURE_ADS`、`FEATURE_LLM_POLISH=false`、`FEATURE_LLM_CHAT=false`；开启追问才配 `MINIMAX_API_KEY`、`MINIMAX_BASE_URL`、`MINIMAX_MODEL`                                                                                                      |
| 费用保护     | `CF_ANALYTICS_TOKEN`、`CF_ANALYTICS_ACCOUNT_ID`、`CF_BILLING_CYCLE_DAY`；CLI 专用 `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`                                                                                                                                                    |
| 开发后备     | `BLOB_READ_WRITE_TOKEN`、`VERCEL_AUTOMATION_BYPASS_SECRET` 不属于当前 Workers 必需项                                                                                                                                                                                                  |

在受信终端生成密钥（输出仅粘贴到 secret manager / `wrangler secret put`，不写交付日志）：

```bash
openssl rand -base64 32                           # AUTH_SECRET / CRON_SECRET 分别生成
node -e 'console.log("v1:"+require("node:crypto").randomBytes(32).toString("base64"))'
# FIELD_ENCRYPTION_KEYS 初次用上行 v1:...；轮换为 v2:<新32字节base64>,v1:<旧key>
# 完成重加密与备份恢复验证前保留旧 key；AAD 绑定表列与 owner，禁止换列移植。
```

操作依据：[Vercel monorepo](https://vercel.com/docs/monorepos)、[Google 验证](https://support.google.com/cloud/answer/13461325?hl=en)、[AdSense Privacy & messaging](https://support.google.com/adsense/answer/10924669?hl=en-GB)、[Neon pooled URI](https://api-docs.neon.tech/reference/getconnectionuri)、[Upstash REST credentials](https://upstash.com/docs/redis/features/restapi)。
