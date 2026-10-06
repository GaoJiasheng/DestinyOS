# CF-EMAIL · Cloudflare Email Service

## 完成项

- 按 Owner 决定替换 Resend；未改其他需求文档、未动 `.codex-runs/`。
- Wrangler 使用官方 `[[send_email]]`，binding 名 `EMAIL`。
- `EMAIL_FROM=noreply@send.gavin.pub`、`EMAIL_FROM_NAME=天机 DestinyOS` 可配置。
- 新增平台 `EmailSender` 接口，Cloudflare 使用请求内 binding，本地/测试使用 mock。
- 魔法链接、订阅失败提醒和后台账户导出统一走平台接口；保留 next-intl zh/en 模板及 zh-TW 支持。
- 移除 Resend SDK、锁文件依赖、RESEND_API_KEY 和旧测试拦截器；同步测试配置、隐私文案与环境变量透传。
- `.env.example`、LAUNCH.md、MORNING.md 已同步；交接包含发信域名 DNS、限制与定价。

## 未完成项（Owner 上线操作）

- Owner 在 Cloudflare 控制台为 send.gavin.pub 单独启用 Email Service > Email Sending，并添加控制台提供的 MX/SPF/DKIM/DMARC 验证记录。
- 验证域名完成后检查生产配额和真实收件；本任务按要求未部署、未写 secrets、未修改 DNS、未 push。

## DESIGN-GAP 列表

- `platform/email.ts`：EMAIL_FROM 保留为纯地址；新增 EMAIL_FROM_NAME，默认显示名来自 shared brand。
- `platform/email.ts`：mock outbox 仅保存最近 100 封内存消息，不记录登录 token/收件人日志；E2E sink 仅接受 HTTP loopback /mail，拒绝重定向。
- `platform/email.ts`：Node 生产模式仅显式测试模式、隔离 Auth secret、loopback origin/sink 下启用 mock；Workers 缺少 EMAIL 时失败，不回退 mock。
- `auth.ts`：保留历史 provider ID `resend` 与既有回调路由兼容性，已不使用 Resend provider 或凭证。
- `stripe-webhook.ts`：binding 无发送幂等键，沿用 D1 webhook 锁和 24 小时去重；发信成功后进程中断可能重复提醒。
- `scripts/test-services.ts`、`scripts/perf-run.ts`：生产 Node 测试显式使用邮件 mock；Stripe/chat 独立预加载机制保留。

## 如何验证（均实际运行，退出码 0）

- `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm build`。
- `pnpm test`：115 文件，3,627 passed、1 skipped；跳过项为显式启用的 MiniMax 真实网络 smoke。
- 覆盖率：statements 99.54%、branches 98.76%、functions 100%、lines 99.85%。
- `pnpm exec vitest run apps/web/test/email.test.ts apps/web/test/stripe-webhook.test.ts`：15 passed。
- `pnpm test:auth:e2e`：6 passed；`TEST_WEB_MODE=production pnpm test:auth:e2e`：6 passed。
- E2E 覆盖 zh/en × desktop/mobile 的模板/发件人、扫描安全、确认登录、token 单次使用、会话撤销、限流和过期 token。
- `pnpm cf:build`：OpenNext 构建和本地预算检查通过，Worker gzip 9,558.82 KiB / 10,240 KiB。
- 邮件单测覆盖 binding 隔离、配置、text/HTML、错误传播、mock 限制；提醒测试覆盖双语去重、失败重试、已删除用户与权益不变。

官方资料：[Workers API](https://developers.cloudflare.com/email-service/api-reference/send/workers/)、[域名](https://developers.cloudflare.com/email-service/configuration/domains/)、[限制](https://developers.cloudflare.com/email-service/platform/limits/)、[定价](https://developers.cloudflare.com/email-service/platform/pricing/)。
