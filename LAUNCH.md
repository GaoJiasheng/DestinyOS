# DestinyOS 上线操作与验收

需求依据：docs/01-prd.md §7、08-security-privacy.md §7、09-architecture.md、13-delivery-plan.md T-64。

## 本次部署检查

2026-10-05：实际执行 Vercel CLI 62.2.0 `whoami`，返回 **Logged out**（退出码 1）；`link --help` 可用。
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

## 环境变量清单

完整模板为 `.env.example`，秘密仅放 Vercel 环境变量/密钥管理，区分 Production 与 Preview，不能进入 NEXT_PUBLIC、Git 或日志。

| 分组      | 变量与配置                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 数据库    | `DATABASE_URL`、`DIRECT_DATABASE_URL`，Neon pooled/直连，独立 Preview 分支                                                                                                                                         |
| 缓存      | `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`；`REDIS_URL` 仅本地可替代 REST                                                                                                                                |
| 认证      | `AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`AUTH_URL`（实际环境 origin）、`AUTH_TRUST_HOST=true`（可信 Vercel 代理）                                                                                   |
| 邮件      | `RESEND_API_KEY`、`EMAIL_FROM`（域名已验证）                                                                                                                                                                       |
| 字段加密  | `FIELD_ENCRYPTION_KEYS`（32 字节，首项当前写入，旧版本保留以读历史密文）                                                                                                                                           |
| 支付      | `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_MONTHLY`、`STRIPE_PRICE_YEARLY`                                                                                                                        |
| 支付选项  | `STRIPE_TAX_ENABLED=false` 直到配置完成；`STRIPE_MONTHLY_CENTS=299`、`STRIPE_YEARLY_CENTS=2499` 是创建产品脚本选项                                                                                                 |
| 广告      | `NEXT_PUBLIC_ADSENSE_CLIENT`、`NEXT_PUBLIC_ADSENSE_SLOT_HOME`、`NEXT_PUBLIC_ADSENSE_SLOT_REPORT_TOP`、`NEXT_PUBLIC_ADSENSE_SLOT_REPORT_BOTTOM`、`NEXT_PUBLIC_ADSENSE_SLOT_TODAY`、`NEXT_PUBLIC_ADSENSE_SLOT_LEARN` |
| 公开配置  | `NEXT_PUBLIC_SITE_URL=https://tianji.gavin.pub`（Preview 改实际 URL）、`NEXT_PUBLIC_DEFAULT_LOCALE=zh`                                                                                                             |
| 功能      | `FEATURE_ADS=true`、`FEATURE_LLM_POLISH=false`；一期运行时不调用 LLM                                                                                                                                               |
| 管理/法律 | `ADMIN_EMAILS`、`PRIVACY_CONTROLLER_NAME`、`PRIVACY_CONTACT_EMAIL`                                                                                                                                                 |
| 监控/定时 | `SENTRY_DSN`、可选 `NEXT_PUBLIC_SENTRY_DSN`、`CRON_SECRET`                                                                                                                                                         |

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
```

完整上线脚本实际调用 `pnpm test:e2e`（包含本地 dev server 与隔离生产服务器套件及 24 项 polish）及移动 Lighthouse CI。
性能命令先检查首页/Three.js gzip 预算（180/220KiB），再验证中英双语、桌面/移动端每日真实内容与离线计算，防止空内容被误记为高分。
首页、today、八字完整报告各 3 次：取最差 Performance ≥85、Accessibility ≥90；产物在 `.lighthouseci/reports/`。
脚本另检查七体系 Fixture A 双语篇幅/章节/禁词/占位符/语言、无时辰、AAD/用户绑定、1000 行日志和 Sentry PII，以及逐条 PRD/安全门槛。
结果输出“通过/未通过”，完整 JSON 在 `.launch-check/results.json`；快速模式未运行浏览器项会明确显示未验证；JSON 还记录运行时间、Node 版本、模式与 local/external 分类，14 份 Fixture A 报告留存在 `.launch-check/reports/`。
`--release` 将任何外部门槛未通过也视为非零退出，不会仅凭本地成功声明可以公开上线。
语言扫描保留文档要求的古文原文、拼音、品牌/署名/技术缩写；正常界面、报告正文和命盘标签仍须本地化。

## 本次本地验证结果（2026-10-05）

最终使用 Node.js 22.23.3 / pnpm 9.15.9；安装、lint、typecheck、test、content:validate、i18n:check、build、`launch:check --full` 均退出 0；许可证与安全策略检查通过。
单元测试 57 文件 / 1213 项，行覆盖率 99.95%、分支 99.07%；完整 `test:e2e` 221 项通过，性能前置真实内容/离线检查另 4 项通过。
32 项本地验收门槛全部通过，另 4 项外部门槛未通过。Fixture A 七体系共 14 份双语报告，篇幅、章节、占位符、禁词和语言检查全部通过；详细字数见 `docs/progress/T-64.md`。
以下是各页面三次移动 Lighthouse 的最差值，使用完整报告，阈值保持 Performance ≥85、Accessibility ≥90：

| 页面         | Performance | Accessibility |
| ------------ | ----------: | ------------: |
| 首页         |          99 |           100 |
| today        |          88 |           100 |
| 八字完整报告 |         100 |           100 |

最终结果为 `.launch-check/results.json`，性能产物为 `.lighthouseci/reports/manifest.json`；这四项外部门槛明确显示未通过：真实 Google 重登、OAuth consent 链接、生产 CSP enforce、Owner 服务/审核/恢复证据。
本轮修复开发 CSP 告警洪泛、首页加密存储按需加载、英文专业表拆字与流式渲染探针；生产 CSP 保持原策略，像素阈值不变。
失败 E2E 的截图与 trace 在后续性能预检前复制至 `.launch-check/browser-failure-*`，避免排错证据被覆盖。

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
