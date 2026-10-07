# DestinyOS · Cloudflare 原生上线清单

主平台为 Cloudflare Workers（OpenNext）。D1、KV、R2 均使用原生 binding，无 Neon、Upstash 或数据库连接 secrets。

## 已创建资源

| Binding                  | 资源                                                 |
| ------------------------ | ---------------------------------------------------- |
| DB                       | destinyos / 7d4b2c61-d7dd-412f-a84e-89eb184378cc     |
| CACHE                    | destinyos-cache / 0db59c62dc5e4e85a9e1ae5eed33693f   |
| EXPORT_BUCKET            | destinyos-exports                                    |
| NEXT_INC_CACHE_R2_BUCKET | destinyos-next-cache                                 |
| RATE_LIMITER             | namespace_id=1001，200/60s 突发；小时维度由 D1 实现  |
| BROWSER                  | destinyos-media 的 Browser Rendering（生产 PDF/PNG） |
| EMAIL                    | Email Service send_email（mail.gavin.pub 发信域名）  |

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
pnpm cf:multi:smoke
pnpm cf:smoke
# 另一个终端；真实 Worker 首页、表单与缓存验证
pnpm test:cloudflare:e2e
```

`pnpm db:deploy` 只写本地 SQLite；`pnpm db:migrate` 应用 Wrangler 本地 D1 迁移。
`pnpm cf:build` 仅构建与 Wrangler 本地 dry-run：主 Worker 原始体积 ≤8MB、media ≤8MB、compute ≤24MB；各自 gzip ≤8MB，不部署。
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
- 费用检查：Owner 将有 Account Analytics Read 权限的 `CLOUDFLARE_API_TOKEN` 同值存为 Worker secret：`cd apps/web && pnpm exec wrangler secret put CF_ANALYTICS_TOKEN -c wrangler.compute.toml`（通过提示输入，不写入文件）。配置 `ADMIN_EMAILS`、`CF_ANALYTICS_ACCOUNT_ID`、实际账单周年日 `CF_BILLING_CYCLE_DAY`；验证 Email Service 真正可发告警。
- Cron 每小时查询账户本计费月 Workers 用量；任一超过 90% 熔断，均低于 80% 或新周期恢复；每日清理并存。`/admin/config` 的费用熔断模式可手动开/关及切回自动。KV 的 circuit/state/mode 为持久状态，切勿给 circuit 设置过期时间。
- CPU 限额 5000ms：本地实际图片 Route Handler 最慢分享 story P99 742.541ms，三倍 2227.623ms，取 Owner 指定的 5000ms 下限；样本范围见 docs/11 §4，发布后按生产 CPU P99 复核 `max(5000, ceil(P99×3))`。Analytics/KV 有延迟且维护请求仍可能计费，此保护不是 Cloudflare 硬性消费封顶。
- WAF **本任务未执行**。Owner 在根目录运行 `pnpm exec tsx scripts/cf-waf-ratelimit.ts --dry-run` 审阅规则（无 token、无 API 调用），再在已设置 `CLOUDFLARE_API_TOKEN` 的终端运行 `pnpm exec tsx scripts/cf-waf-ratelimit.ts`。令牌需 gavin.pub 的 Zone Read 与 Zone WAF Edit 权限；禁止写入仓库或命令行明文。
- 脚本定位 gavin.pub、按 ref 幂等追加/更新自己的规则，保留其他规则；阻断 tianji.gavin.pub IP 60/10s，持续 60s，排除静态路径；按 Cloudflare 边缘位置计数。若套餐不支持 60 秒 mitigation，Owner 升级/调整套餐后重跑，不静默放宽。
- 未部署、未写远端 secrets、未调用真实商店或支付；验证结果与 DESIGN-GAP 见 docs/progress/WEB-NOPAY.md。

## PERF-WEB-2：同账户多 Worker 发布

- `destinyos`：主入口、费用熔断/健康检查、版本隔离的 HTML/RSC Cache API、构建产物与 cron；`COMPUTE`/`MEDIA` 为 Service Bindings。
- `destinyos-compute`：Next/Auth/Action、排盘/解读、Prisma/D1、KV/R2 与邮件；配置 `apps/web/wrangler.compute.toml`。公网入口和 preview URLs 关闭。
- `destinyos-media`：分享图/OG 的 satori/resvg、Browser Rendering 导出、需要完整转换的自由文本；配置 `apps/web/wrangler.media.toml`，公网入口关闭，不接收会话 cookie。
- 同一份 `pnpm cf:build` 生成三个 Worker 及静态资产。先上传 **media → compute → main**；只对主 Worker 绑定域名/cron。以下命令供 Owner 后续获准发布时使用，本任务未执行：

```bash
cd apps/web
pnpm exec wrangler deploy -c wrangler.media.toml
pnpm exec wrangler deploy -c wrangler.compute.toml
pnpm exec wrangler deploy -c wrangler.toml
```

- 原应用 secrets 配置到 compute（Auth/OAuth、加密、RevenueCat、模型、可选支付、`CF_ANALYTICS_TOKEN` 等）；主 Worker 需要 `CRON_SECRET`，费用检查与邮件在 compute 执行。主与 compute 的 `CRON_SECRET` 必须相同。D1/KV/R2/EMAIL 配置指向同一资源；media 仅需 BROWSER/ASSETS。客户端 Sentry 仅在构建时配置 `NEXT_PUBLIC_SENTRY_DSN` 后加载，服务端不再加载 Sentry。
- 三份配置的 `NEXT_PUBLIC_SITE_URL` 保持主站同一 origin；compute 保留 `AUTH_URL` 主站 origin。公开文案、知识库 zh-TW 在构建期转换，更新须重新构建发布。
- `pnpm cf:multi:smoke` 自动启动三实例并检查首个冷请求、RSC/预取缓存、载荷、私有会话绕过与真实 zh/zh-TW PNG；结果写 `.test-data/perf-web-2.json`。`pnpm cf:smoke` 启动持续联调，另一个终端运行 `PERF_TTFB_URL=http://localhost:8787 pnpm perf:ttfb` 和 `pnpm test:cloudflare:e2e`。
- Service Binding 调用不增加请求费用；Browser Rendering 等资源沿用现有配额。子 Worker 动态请求仍有自身冷启动，主公共路径不加载 Prisma/引擎/媒体。
- 回滚时三个服务与资产使用同一构建版本；主版本切换自动隔离边缘缓存。不能仅回滚 main 并混用其他版本的 Action/媒体协议。
- 本地 workerd 数据与新加坡生产指标分开记录；上线后须重新采样 SIN 冷请求和公共跳转 P75，任务没有部署或生产验收。
