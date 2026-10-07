任务：修正上一个任务（commit 017145d）。上一轮按旧要求实现了 Web 端 Stripe 两档购买；Owner 已改为「网站暂不收款」，并追加了费用熔断。在现有实现基础上按以下要求修改（Stripe 两档代码保留，只是默认关闭）：

要做：
1. 新增功能开关 FEATURE_WEB_PAYMENTS（默认 false）。关闭时：/pricing 与 /me/billing 不出现任何 Stripe 购买按钮，改为介绍会员权益（去广告、无限历史、更多分享模板、PDF 导出等以现有实现为准），价格显示「2.99 美元/月 或 6.99 美元永久」，主按钮为「在 App 中开通」：桌面端显示 App Store 与 Google Play 下载按钮和二维码（商店链接用配置项 NEXT_PUBLIC_APP_STORE_URL、NEXT_PUBLIC_PLAY_STORE_URL，为空时显示「即将上架」）；移动端浏览器直接跳商店。文案 zh/zh-TW/en。
2. Stripe 相关代码保留但在开关关闭时完全不加载（路由返回 404、脚本不注入、环境变量非必需）；产品创建脚本改为两档（2.99 美元月订阅 + 6.99 美元一次性付款，取消年付），以便将来开启。
3. 会员权益来源改为 RevenueCat：新增 POST /api/v1/mobile/webhooks/revenuecat（验签、幂等，按 entitlement `pro` 设置或取消 User.plan，支持非消耗型永久权益与订阅到期），以及登录用户在网页上「刷新会员状态」时调用 RevenueCat REST API 查询（REVENUECAT_SECRET_KEY 缺失时跳过）。App 与 Web 用同一个用户 ID 作为 RevenueCat appUserID。
4. 更新 docs/11-ads-and-billing.md、LAUNCH.md、MORNING.md、.env.example、docs/app/00-app-plan.md §6。测试全部通过，提交。

附加任务：Cloudflare 费用熔断（Owner 待办，防止被刷量导致自动扣费）。
5. apps/web/wrangler.toml 设置 `[limits] cpu_ms`（按实际最慢路由的 P99 留 3 倍余量，不低于 5000），并在 docs 说明取值依据。
6. 写一个脚本 scripts/cf-waf-ratelimit.ts（使用 Cloudflare API，令牌从环境变量 CLOUDFLARE_API_TOKEN 读取，不提交任何令牌）创建 gavin.pub 区域的一条限流规则：tianji.gavin.pub 下同一 IP 每 10 秒超过 60 个请求即阻断 60 秒，静态资源路径除外；脚本支持 --dry-run，并在 LAUNCH.md 写明 Owner 如何运行。本任务只写脚本，不执行。
7. 熔断：新增每小时 Cron（与现有每日 Cron 并存），用 Cloudflare GraphQL Analytics API（令牌同上，作为 Worker secret CF_ANALYTICS_TOKEN）查询本计费月 Workers 请求数与 CPU 毫秒数；超过包含额度（1000 万次请求、3000 万 CPU 毫秒）的 90% 时：在 KV 写入 circuit=open，全站切维护模式（静态维护页，zh/zh-TW/en），停用 PDF 导出、追问大师、分享图生成，并通过 Email Service 给 ADMIN_EMAILS 发邮件；低于 80% 或进入新计费月时自动恢复；后台 /admin/config 可手动开关。单测覆盖阈值、恢复与令牌缺失时跳过。
