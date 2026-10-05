# DestinyOS 上线操作与验收

需求依据：docs/01-prd.md §7、08-security-privacy.md §7、09-architecture.md、13-delivery-plan.md T-64。

今早按 [MORNING.md](MORNING.md) 执行：Cloudflare 优先、Vercel Pro 备选；包含创建顺序、逐项 secret put、构建变量回填、迁移导入、耗时和验证。

## 本次部署检查

2026-10-05 初查、2026-10-06 复查：实际执行 Vercel CLI 62.2.0 `whoami`，返回 **Logged out**（退出码 1）；`link --help` 可用。
因此没有创建项目、没有部署 Preview，Preview URL：**未生成**。Owner 按下面步骤完成账号与生产服务配置。
本地自动验收与外部发布门槛分别记录，不能把本地替身验证当成真实 Google、Stripe 或 AdSense 审核。

## Owner 操作顺序

1. **Vercel Pro**：登录正确团队，导入此仓库，项目名可用 `destinyos`，Framework 选 Next.js，Root Directory 选 `apps/web`，允许构建访问根目录外的 workspace 文件，Node.js 22。
   应用根的 `apps/web/vercel.json` 已配置工作区安装、迁移后构建、每日 03:00 UTC cron；不要直接用 `next build` 跳过内容编译。
   按 [Vercel monorepo 操作说明](https://vercel.com/academy/production-monorepos/deploy-web-app) 配置 Root Directory；[Next.js 15 tracing](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output) 覆盖应用根外的知识库。
2. **Neon**：创建 PostgreSQL 16 数据库，选择与 Vercel 函数相近的区域；pooled URL 写 `DATABASE_URL`，直连 URL 写 `DIRECT_DATABASE_URL`，保留 TLS 参数。
   Production 独立数据库；每个 Preview 使用独立 Neon 分支，不能让 Preview 的迁移、内容或删除 cron 操作生产数据。
3. **Upstash**：创建 Redis，设置 REST URL/token；生产不填本地 `REDIS_URL`。检查限流、每日缓存、健康检查与 webhook 去重。
4. **Resend**：验证发件域名的 SPF/DKIM，设置 API key 与真实 `EMAIL_FROM`；在 zh/en 实际测试魔法链接确认、过期和单次使用。
5. **Google OAuth**：设置 Web 客户端，来源为 `https://tianji.gavin.pub`，回调为 `https://tianji.gavin.pub/api/auth/callback/google`。
   consent screen 设置真实品牌/联系邮箱、已验证域名、隐私政策 `https://tianji.gavin.pub/zh/privacy`、条款 `/zh/terms`，请求范围仅 openid/email/profile；将发布状态切为 **Production**。
   Preview 单独客户端并登记其完整回调地址。生产验收 Google 登录→删除→重新登录为全新用户，记录新旧 ID，确认旧报告/分享不可访问。
6. **Stripe**：先用 test mode，设置 API secret 后运行 `pnpm stripe:products`，复制月/年 price ID；建议 USD 2.99/月、24.99/年，价格变更须同步双语价格/条款。
   Customer Portal 开启付款方式、月年切换、到期取消；启用收据/发票。完成 Stripe Tax 配置后才设 `STRIPE_TAX_ENABLED=true`。
   webhook URL 为 `/api/v1/stripe/webhook`，事件：`checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`、`invoice.payment_failed`。
   分别配置 test/live endpoint secret；验证签名、重复事件、取消到期广告恢复，再切 live 产品/价格/密钥，禁止混用两套模式。
7. **AdSense**：申请站点 `tianji.gavin.pub`，审核通过后填写 publisher ID 与五个广告 slot ID。
   Privacy & messaging 发布欧洲法规消息（认证 CMP/TCF v2.2）和美国州法规消息，配置 RDP/GPC；EEA/UK/CH 网络实测拒绝个性化、页脚/设置重开选择、13–17 岁非个性化广告、会员无广告。
   审核尚未通过不得记作完成；无 publisher 或 slot 时应用会省略广告。
8. **法律身份与监控**：填运营者法定身份、隐私联系邮箱、管理员白名单；配置 Sentry、脱敏、错误率/异常告警接收人，以及 Vercel/Sentry 安全日志 30 天保留。
9. **Preview**：安装/使用 Vercel CLI，`pnpm dlx vercel login`；在仓库根 `pnpm dlx vercel link`，确认项目 Root Directory；`pnpm dlx vercel deploy`。
   将生成的实际 URL 写回本文，跑健康检查与完整双语验收，确认 Preview 使用隔离服务。Owner 批准后才执行 Production 发布并绑定 `tianji.gavin.pub`，DNS 以 Vercel 控制台实际提示为准。

## Cloudflare Workers 部署（保留上面的 Vercel 路径）

两条路径共用 Next.js、数据库 schema、认证、支付与 API。Vercel 设置 `PLATFORM=vercel`；
Cloudflare 的 `wrangler.toml` 设置 `PLATFORM=cloudflare`。不设置时自动检测 Workers，Node 默认 Vercel。

1. 开通 **Workers Paid**，使用 Node.js 22 和本仓库锁定的 OpenNext/Wrangler。
   当前适配基于 [OpenNext 官方步骤](https://opennext.js.org/cloudflare/get-started)；Workers 的 CPU、启动、内存、未压缩 Worker 及资产限制见 [官方配额](https://developers.cloudflare.com/workers/platform/limits/)。
2. 在 `apps/web` 下运行 `pnpm exec wrangler login`（CI 使用最小权限的 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`）。
   创建桶：`pnpm exec wrangler r2 bucket create destinyos-exports` 和 `pnpm exec wrangler r2 bucket create destinyos-next-cache`。
   `EXPORT_BUCKET` 禁止启用 r2.dev/公共域名；在控制台为 `report-exports/` 设置 1 天删除的 lifecycle rule。
   应用同时检查精确 24h TTL；下载仍要求登录、所有权及导出权限。缓存桶不得与私有导出桶混用。
3. 启用 Browser Rendering（现名 Browser Run），绑定 `BROWSER`；字体由本站 `/_next/static` / `fonts` 资源提供，无第三方字体请求。
   按 [当前计费](https://developers.cloudflare.com/browser-run/pricing/) 设置预算告警；Paid 含每月 10 browser hours 和 10 个平均并发会话，超额计费。
   [硬性并发/新会话限制](https://developers.cloudflare.com/browser-run/limits/) 与计费额度不同；配额不足时导出返回失败，不降级为无权限公开链接。
4. **Neon 与 Upstash**：生产使用独立分支/实例，Neon 选择接近主要用户的区域（亚洲用户优先 Singapore，可用性以控制台为准）；
   Upstash REST 同区优先。Workers 从全球访问，跨区数据库事务会增加延迟，应从目标地区实测。
   `DATABASE_URL` 保留 Neon TLS/pooled 参数；Workers 通过 `@prisma/adapter-neon` WebSocket 支持交互事务。
   不配置 TCP `REDIS_URL`。迁移仍由 Node CI/可信终端通过 `DIRECT_DATABASE_URL` 执行，不能在请求或 Cron 中迁移。
5. 将 `.env.example` 的服务配置逐一填入 Worker secrets。以下命令在 `apps/web` 下执行，每次交互粘贴对应值：

   ```bash
   pnpm exec wrangler secret put DATABASE_URL
   pnpm exec wrangler secret put UPSTASH_REDIS_REST_URL
   pnpm exec wrangler secret put UPSTASH_REDIS_REST_TOKEN
   pnpm exec wrangler secret put AUTH_SECRET
   pnpm exec wrangler secret put AUTH_GOOGLE_ID
   pnpm exec wrangler secret put AUTH_GOOGLE_SECRET
   pnpm exec wrangler secret put RESEND_API_KEY
   pnpm exec wrangler secret put FIELD_ENCRYPTION_KEYS
   pnpm exec wrangler secret put STRIPE_SECRET_KEY
   pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET
   pnpm exec wrangler secret put CRON_SECRET
   # 仅启用 AI 追问时：
   pnpm exec wrangler secret put MINIMAX_API_KEY
   ```

   `DIRECT_DATABASE_URL` 只需配置在迁移终端/CI；如将其存入 Worker，也必须用 `wrangler secret put`。
   `EMAIL_FROM`、`ADMIN_EMAILS`、Stripe price IDs、法律身份、功能开关等非秘密项配置于 `wrangler.toml` 的 `[vars]`。
   `NEXT_PUBLIC_*` 在构建时注入；运行时修改不能改变已编译客户端。不要把秘密放进 NEXT_PUBLIC 或 Wrangler `[vars]`。

6. 仓库根执行 `pnpm install --frozen-lockfile`、`pnpm db:deploy`、`pnpm content:import`、`pnpm cf:build`。
   `pnpm cf:preview` 调用 wrangler dev，默认本地 R2 模拟；`apps/web/.dev.vars` 放隔离本地 secrets，禁止 Git 提交。
   锁定的 Wrangler 支持本地 Browser proxy，并自动下载测试 Chromium；本地绑定验证不代表已验证云端配额与网络。
   真正远程浏览器无法访问 localhost；部署后使用隔离 HTTPS 预览源复验八大体系 PDF/PNG 的页数、字体和权限。
   本地 Chromium 不可用时运行 Browser Rendering mock 单测，并明确记录该限制。
7. `pnpm cf:deploy` 构建并发布 Workers。CI 的 `cloudflare-build` 仅构建和 dry-run，绝不部署。
   Cron Triggers 已设 `0 3 * * *`（UTC）；scheduled 进入同一个带 CRON_SECRET 的维护函数，无公开网络调用。
   在隔离环境用 `wrangler dev --test-scheduled` 和 `/__scheduled?cron=0+3+*+*+*` 验证，禁止把测试 Cron 接入生产数据库。
8. 预览验收后，把 `tianji.gavin.pub` 纳入 Cloudflare 托管 zone，在 Workers → Settings → Domains 添加 Custom Domain，
   或启用 `wrangler.toml` 注释中的 `[[routes]] custom_domain=true`；DNS/TLS 以控制台实际状态为准。
   同步 `AUTH_URL`、`NEXT_PUBLIC_SITE_URL`、Google callback 和 Stripe webhook；一个生产域名一次只指向一个平台。
   `AUTH_TRUST_HOST=true` 仅用于可信代理；Google/Resend/Stripe 的真实验收继续按上文执行。
9. 在 Workers Logs / `wrangler tail` 检查脱敏 JSON、响应错误与配额；设置与 08 文档一致的日志保留期。
   回滚 Workers 至上一已验收版本，同时保留兼容的 Neon schema 和字段密钥。Vercel 的回滚流程继续有效。

### Cloudflare 本地验收命令

先用隔离 `.dev.vars` 配置 AUTH_SECRET、CRON_SECRET、Stripe 测试 secrets 和 MiniMax key；不要接生产数据库。
无真实 Upstash 时可设置 `UPSTASH_REDIS_REST_URL=http://127.0.0.1:8791`、测试 token，分别运行：

```bash
pnpm exec tsx scripts/cloudflare-redis-mock.ts
pnpm cf:preview
pnpm test:cloudflare:e2e
# 独立 workerd SDK/存储/浏览器探针，始终不部署此测试入口：
pnpm --filter @tianji/web exec wrangler dev test/cloudflare-runtime-worker.ts --port 8788 --name destinyos-runtime-smoke
```

探针 `/services` mock 验证 Resend 序列化与 Stripe 原始 body 签名；`/storage` 验证本地 R2 和 Upstash REST；
`/llm` 使用实际配置的 MiniMax key 输出 NDJSON；`/render?format=pdf|png` 使用本地 Browser binding 渲染三页字体 fixture。
测试入口不被生产 `worker.ts` 导入；真实 Google/Resend 邮件、Neon 事务和付费账户追问仍须在隔离云端服务上验收。
Cloudflare Assets 自行协商压缩；`cf:build` 会展开每日 worker 的预压缩副本，避免重复压缩，Vercel 继续使用原 Brotli 产物。

此前 Cloudflare 适配阶段（历史证据）：2026-10-06 使用 Node 25.8.2 / pnpm 9.15.9：Wrangler 中英首页、匿名完整八字、每日运势与日期切换均通过；
真实 MiniMax key 的 workerd 流式探针收到 delta 与 usage，双语 `next/og` 返回 PNG。
本地 Browser binding 的字体 fixture 生成三页 A4 PDF（中文 Noto、英文 Cormorant 均嵌入）及 2480×3508、300dpi PNG。
R2 本地存取、Upstash REST mock、Resend mock 与 Stripe WebCrypto 原始 body 签名通过。
最终部署 dry-run 压缩 Worker 为 9180.18 KiB，构建产物密钥扫描通过；这些证据不替代云端服务与真实账户验收，未进行部署。
Vercel 路径 `pnpm build` 与 5 项原有导出 E2E 通过（中英八体系 PDF/PNG、所有权、会员、缓存、配额及下载进度）；
该适配阶段 install/lint/typecheck/test 通过，单测为 85 文件 / 3565 项；合并后本轮数据见下方最新结果。

## 环境变量清单

完整模板为 `.env.example`，秘密仅放所选平台的环境变量/密钥管理，区分 Production 与 Preview，不能进入 NEXT_PUBLIC、Git 或日志。

| 分组      | 变量与配置                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 数据库    | `DATABASE_URL`、`DIRECT_DATABASE_URL`，Neon pooled/直连，独立 Preview 分支                                                                                                                                         |
| 缓存      | `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`；`REDIS_URL` 仅本地可替代 REST                                                                                                                                |
| 认证      | `AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`AUTH_URL`（实际环境 origin）、`AUTH_TRUST_HOST=true`（可信 Vercel/Cloudflare 代理）                                                                        |
| 邮件      | `RESEND_API_KEY`、`EMAIL_FROM`（域名已验证）                                                                                                                                                                       |
| 字段加密  | `FIELD_ENCRYPTION_KEYS`（32 字节，首项当前写入，旧版本保留以读历史密文）                                                                                                                                           |
| 支付      | `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_MONTHLY`、`STRIPE_PRICE_YEARLY`                                                                                                                        |
| 支付选项  | `STRIPE_TAX_ENABLED=false` 直到配置完成；`STRIPE_MONTHLY_CENTS=299`、`STRIPE_YEARLY_CENTS=2499` 是创建产品脚本选项                                                                                                 |
| 广告      | `NEXT_PUBLIC_ADSENSE_CLIENT`、`NEXT_PUBLIC_ADSENSE_SLOT_HOME`、`NEXT_PUBLIC_ADSENSE_SLOT_REPORT_TOP`、`NEXT_PUBLIC_ADSENSE_SLOT_REPORT_BOTTOM`、`NEXT_PUBLIC_ADSENSE_SLOT_TODAY`、`NEXT_PUBLIC_ADSENSE_SLOT_LEARN` |
| 公开配置  | `NEXT_PUBLIC_SITE_URL=https://tianji.gavin.pub`（Preview 改实际 URL）、`NEXT_PUBLIC_DEFAULT_LOCALE=zh`                                                                                                             |
| 功能      | `FEATURE_ADS=true`、`FEATURE_LLM_POLISH=false`；核心报告使用规则引擎；可选 B-05 `FEATURE_LLM_CHAT=false`                                                                                                           |
| 管理/法律 | `ADMIN_EMAILS`、`PRIVACY_CONTROLLER_NAME`、`PRIVACY_CONTACT_EMAIL`                                                                                                                                                 |
| 监控/定时 | `SENTRY_DSN`、可选 `NEXT_PUBLIC_SENTRY_DSN`、`CRON_SECRET`                                                                                                                                                         |

附加功能变量（均已列入 `.env.example`）：

- PDF/PNG 导出：Vercel 生产配置 `BLOB_READ_WRITE_TOKEN` 并使用私有 Blob，确保不同函数实例能下载同一产物；本地未配置时使用临时目录。Preview 保护启用时设置服务端 `VERCEL_AUTOMATION_BYPASS_SECRET`。Cloudflare 使用私有 `EXPORT_BUCKET` 与 `BROWSER`，无需 Blob token。
- 可选 AI 追问：`MINIMAX_API_KEY`、`MINIMAX_BASE_URL`、`MINIMAX_MODEL`；端点和模型须与账户匹配。默认关闭 `FEATURE_LLM_CHAT`，开启前复核去 PII 边界与付费用量；核心报告保持离线规则生成。

单独生成 AUTH_SECRET、CRON_SECRET：每次运行 `openssl rand -base64 32`，不要复用字段加密密钥。
生成 FIELD_ENCRYPTION_KEYS（在自己的安全终端执行，将结果直接存入秘密管理）：

```bash
node -e "console.log('v1:' + require('node:crypto').randomBytes(32).toString('base64'))"
```

轮换时生成新 32 字节密钥，配置 `v2:<new-base64>,v1:<old-base64>`，先备份，再运行 `pnpm exec tsx scripts/rotate-keys.ts`。
验证所有列能解密、已转为 v2 后，按保留周期保管旧密钥以恢复旧备份；不能过早删除。加密使用用户 HKDF 子密钥和 table.column AAD。

## 首次迁移与内容导入

在仓库根、已注入对应数据库变量的可信环境执行：

```bash
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm content:import
pnpm build
```

`content:import` 先校验/编译，再在事务中导入 KU 和不可变 Release；重复执行不产生重复记录，冲突拒绝覆盖，须增加内容版本后重试。
升级应用前保留数据库备份；已有数据库用 `migrate deploy`，生产禁止 `migrate dev`/`db push`。
Vercel 构建已先执行迁移；后续内容版本发布需要显式 `content:import` 或后台 Release，应用构建不会覆盖数据库已发布内容。

## 自动验收

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm i18n:check
pnpm build
pnpm launch:check --full
pnpm cf:build
```

完整上线脚本实际调用 `pnpm test:e2e`（包含本地 dev server 与隔离生产服务器套件及 36 项 polish（含三语言新增页面））及移动 Lighthouse CI。
Cloudflare 绑定专项 `test:cloudflare:e2e` 需另启动 Wrangler 8787 服务，不运行于 Next.js dev server；入口注册与隔离由 launch-check 验证。Cloudflare 构建另执行 `cf:build`。
性能命令先检查首页/Three.js gzip 预算（180/220KiB），再验证中英双语、桌面/移动端每日真实内容与离线计算，防止空内容被误记为高分。
首页、today、八字完整报告、合盘与日历各 3 次：取最差 Performance ≥85、Accessibility ≥90；产物在 `.lighthouseci/reports/`。
脚本另检查原七体系及生命灵数 Fixture A、Fixture A/B 合盘 双语篇幅/章节/禁词/占位符/语言、无时辰、AAD/用户绑定、1000 行日志和 Sentry PII，以及逐条 PRD/安全门槛。
结果输出“通过/未通过”，完整 JSON 在 `.launch-check/results.json`；快速模式未运行浏览器项会明确显示未验证；JSON 还记录运行时间、Node 版本、模式与 local/external 分类，18 份双语 Fixture 报告留存在 `.launch-check/reports/`。
`--release` 将任何外部门槛未通过也视为非零退出，不会仅凭本地成功声明可以公开上线。
语言扫描保留文档要求的古文原文、拼音、品牌/署名/技术缩写；正常界面、报告正文和命盘标签仍须本地化。

## 本次本地验证结果（2026-10-06）

Node.js 25.8.2 / pnpm 9.15.9；实际运行 install、lint、typecheck、test、content:validate、i18n:check、build、`launch:check --full`，均退出 0；许可证（1147 包，无 GPL/AGPL）、安全策略和 audit（四项既有限定例外）通过。
单元测试 113 文件 / 3611 项通过，真实供应商 smoke 跳过 1 项；行覆盖率 99.85%、分支 98.87%。完整 `test:e2e` 共 22 组 / 294 项通过，含 36 项 polish；性能前置真实内容/离线检查另 4 项通过。
37 项本地验收门槛全部通过，4 项外部门槛未通过。Fixture A 八体系及 A/B 合盘共 18 份双语报告，篇幅、章节、占位符、禁词、语言及零级分享隐私通过；详细字数见 [T-64](docs/progress/T-64.md)。
3826 KU、627 双语术语、27 篇双语长文有效；知识/解读/引擎版本为 1.7.1/1.2.1/0.3.0。62 份 POLISH 报告、字体覆盖及首页/Three.js 180/220KiB 预算一并通过。
各页面三次移动 Lighthouse 的最差值，阈值保持 Performance ≥85、Accessibility ≥90：

| 页面         | Performance | Accessibility |
| ------------ | ----------: | ------------: |
| 首页         |         100 |           100 |
| today        |          93 |           100 |
| 八字完整报告 |          98 |           100 |
| 合盘         |          99 |           100 |
| 日历         |          96 |           100 |

结果：`.launch-check/results.json`；18 份报告：`.launch-check/reports/`；性能：`.lighthouseci/reports/manifest.json`。四项外部门槛明确显示未通过：真实 Google 重登、OAuth consent 链接、生产 CSP enforce、Owner 服务/审核/恢复证据。
本次修复中文学习文章、术语百科及合盘的语言残留；合盘 bundle 补齐四体系证据术语，正文仍保留原术语密度策略，原始证据不变。新增文章语言探针、A/B 合盘报告与分享隐私检查、独立 Wrangler 套件注册/隔离检查。逐张审查后更新四张手机合盘文案截图，容差保持 09 §11 的 0.5%。
失败 E2E 截图和 trace 保存至 `.launch-check/browser-failure-*`；本轮部署未执行，Vercel `whoami` 为 Logged out，Preview URL 尚无。Cloudflare 优先/Vercel 备选的逐步交接见 [MORNING.md](MORNING.md)。

本轮 `pnpm cf:build` 与实际体积门槛通过：minify 后未压缩 36040.92KiB / 65536KiB，gzip 8655.30KiB；Wrangler 双语专项另 2 项通过。6307 个构建文件秘密扫描通过，仅保留 NEXT_PUBLIC 默认值；没有部署到云端。当前 Worker 限额依据 [2026-09-04 官方变更](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/)，gzip 不再作为配额。

## 仍需发布证据

- CSP 按 08 §5 先 Report-Only 至少一周，查看 `/api/v1/csp/report` 的匿名违规计数，带真实 AdSense/CMP/Stripe 遍历页面；静态页内联脚本也必须审计。
  当前保持 Report-Only，不具备生产一周零违规证据，**尚未 enforce**；不能只改响应头而让静态页的脚本被 nonce 拦截。
- 实际数据库 dump 密文检查、实际生产 1000 行日志、Sentry 测试事件、Google 重新登录、真实支付/取消、CMP 地区验证。
- 内容 5% 人工审稿尚未完成，`reviewed_by=null` 没有被伪造成审批；相似度 warning 需人工编辑复核。
- astro.com 参考盘导出、已有 Fixture F/奇门流派差异、VoiceOver 与真实低端设备帧率检查，见 `docs/progress/SUMMARY.md`。

## 备份演练与回滚

1. Neon 启用恢复窗口；发布前记录应用 deployment ID、迁移版本、KnowledgeRelease 版本；数据库备份与字段密钥分开保管。
2. 在独立恢复分支实际恢复备份，核验用户数/报告数、密文解密、AAD 拒绝、健康检查；记录恢复耗时和结果，演练库不接真实邮件、支付或广告。
3. 应用故障：Vercel 提升上一个已验收 Production deployment；不可逆数据库迁移不得盲目降级，采用兼容回滚或向前修复。
4. 内容故障：后台发布旧不可变 Release 为新版本，不修改旧报告；数据库故障按已演练恢复流程切换连接并复验。
5. 如字段密钥事故，恢复相应密钥版本；记录操作审计，审计不包含出生信息、邮箱或问题正文。
