# 给 Owner 的今早部署清单 · 2026-10-06

优先 Cloudflare Workers，Vercel Pro 备选。代码与本地验收已准备；真实服务、域名及审核仍需你的账号操作。Vercel `whoami` 实测 Logged out，当前没有 Preview URL。完整发布门槛、备份和回滚见 [LAUNCH.md](LAUNCH.md)，任务状态见 [SUMMARY](docs/progress/SUMMARY.md)。下面时间是操作估计，不包含 DNS、邮件域名、OAuth 或 AdSense 审核等待。

## 1. 准备终端与 Cloudflare 账号（5–10 分钟）

使用 Node.js 22.17+（建议 22 LTS）和 pnpm 9.15.9，命令从仓库根执行，标注 `cd` 的除外：

```bash
cd /Users/gavin/work/DestinyOS
pnpm install --frozen-lockfile
pnpm --filter @tianji/web exec wrangler login
pnpm --filter @tianji/web exec wrangler whoami
```

开通 Workers Paid；确认 `gavin.pub` zone 可在此账号管理。验证：`whoami` 显示正确账号，控制台 Workers、R2、Browser Run 可用。CI 的 `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` 只存 CI secrets，不上传到 Worker。

## 2. 开通 R2 与 Browser Rendering（5–10 分钟）

```bash
pnpm --filter @tianji/web exec wrangler r2 bucket create destinyos-exports
pnpm --filter @tianji/web exec wrangler r2 bucket create destinyos-next-cache
pnpm --filter @tianji/web exec wrangler r2 bucket list
```

已有桶时不必重建。`apps/web/wrangler.toml` 已绑定 `EXPORT_BUCKET`、`NEXT_INC_CACHE_R2_BUCKET` 和 `BROWSER`。在控制台启用 Browser Rendering / Browser Run，设置费用告警；导出桶保持私有，给 `report-exports/` 前缀设置一天删除规则。验证：列表中两个桶存在；部署后登录会员导出 PDF/PNG，字体完整、下载受所有权保护，超过 24h 失效。R2 与 Browser Run 的[绑定规范](https://developers.cloudflare.com/workers/wrangler/configuration/)以当前控制台为准。

## 3. 按顺序创建外部服务并回填（约 45–90 分钟）

先建独立测试/Preview 资源，验收后换生产资源；生产与 Preview 不共用数据库、密钥或删除 Cron。

| 顺序 / 时间                 | 创建与回填                                                                                                                                                                                                                                                | 验证                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ① Neon / 5–10 分钟          | PostgreSQL 16；pooled TLS URL → `DATABASE_URL`，直连 → `DIRECT_DATABASE_URL`；另建 Preview branch。                                                                                                                                                       | 从可信终端连通；迁移成功；上线后 `/api/health` 的 DB 检查通过。                                                    |
| ② Upstash / 5 分钟          | Redis REST URL/token → `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`；Workers 不填 TCP `REDIS_URL`。                                                                                                                                               | `/api/health` 的 Redis 检查通过；重复试算命中缓存、超限返回 429。                                                  |
| ③ Resend / 10–15 分钟       | 验证发信域名并添加所需 DNS；API key → `RESEND_API_KEY`，已验证发信地址 → `EMAIL_FROM`。                                                                                                                                                                   | 邮箱登录收到魔法链接；链接仅用一次、15 分钟后过期。                                                                |
| ④ Google OAuth / 10–15 分钟 | Web 客户端 → `AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`；回调 `https://tianji.gavin.pub/api/auth/callback/google`。consent 填真实品牌、已验证域名、`/zh/privacy`、`/zh/terms`，仅 openid/email/profile，发布状态切 **Production**。Preview 单独客户端和回调。 | 正式域名 Google 登录成功；删除后重新登录成为新用户，旧报告与分享不可访问；核对 consent 政策链接。                  |
| ⑤ Stripe / 10–20 分钟       | 先 test mode，再 live mode 分开创建产品、月/年价格和 webhook；回填四项 STRIPE 配置。                                                                                                                                                                      | 购买去广告→取消→到期恢复广告；验签、重复事件不重复入账；live 与 test 不混用。                                      |
| ⑥ AdSense / 10–15 分钟提交  | 申请 `tianji.gavin.pub`；publisher 和五个 slot 回填构建变量。Privacy & messaging 发布欧洲法规 CMP 与美国州法规消息，配置 GPC/RDP。                                                                                                                        | 控制台审核通过；EEA/UK/CH 拒绝个性化有效，页脚能重开选择，会员无广告、13–17 岁非个性化。审核等待不算今早操作完成。 |

Stripe 产品命令（先将 test secret 写入下面的本地安全配置文件；再在 live mode 重做）：

```bash
node --env-file=apps/web/.env.production.local --run stripe:products
```

将输出的 `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` 回填同一环境。控制台 Customer Portal 开启到期取消与月年切换。webhook：`https://tianji.gavin.pub/api/v1/stripe/webhook`；订阅 `checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`、`invoice.payment_failed`；endpoint signing secret → `STRIPE_WEBHOOK_SECRET`。Stripe Tax 未配置前保持 `STRIPE_TAX_ENABLED=false`。

## 4. 生成密钥并上传所有运行时变量（10–15 分钟）

```bash
cp .env.example apps/web/.env.production.local
openssl rand -base64 32
openssl rand -base64 32
node -e "console.log('v1:' + require('node:crypto').randomBytes(32).toString('base64'))"
```

前三个输出分别存为独立的 `AUTH_SECRET`、`CRON_SECRET`、`FIELD_ENCRYPTION_KEYS`；最后格式为 `v1:<32字节base64>`。文件已被 Git 忽略，权限设为 `chmod 600 apps/web/.env.production.local`。将数据库示例 URL 替换为 Neon，并清空模板的本地 `REDIS_URL`。在自己的终端生成并直接存秘密管理；轮换保留旧版本，见 LAUNCH。填真实运营主体、隐私联系邮箱和管理员邮箱，不留下 About/法律身份占位资料。

以下逐条执行、交互粘贴值（不会把密钥写在命令历史中）。`secret put` 初次可能提示创建名为 destinyos 的 Worker；此时只是配置，完整应用在第 6 步部署。配置以 `apps/web/wrangler.toml` 为准：

```bash
cd apps/web
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
# 这些不是密钥，但可用 secrets 避免将运营配置提交到 Git：
pnpm exec wrangler secret put EMAIL_FROM
pnpm exec wrangler secret put ADMIN_EMAILS
pnpm exec wrangler secret put STRIPE_PRICE_MONTHLY
pnpm exec wrangler secret put STRIPE_PRICE_YEARLY
pnpm exec wrangler secret put PRIVACY_CONTROLLER_NAME
pnpm exec wrangler secret put PRIVACY_CONTACT_EMAIL
# 可选监控；未开通则跳过：
pnpm exec wrangler secret put SENTRY_DSN
# 仅启用 AI 追问时上传；默认 FEATURE_LLM_CHAT=false：
pnpm exec wrangler secret put MINIMAX_API_KEY
pnpm exec wrangler secret list
cd ../..
```

验证：`secret list` 含必需名称，不显示值。`DIRECT_DATABASE_URL` 仅留迁移终端/CI；Worker 不需要。`BLOB_READ_WRITE_TOKEN` / `VERCEL_AUTOMATION_BYPASS_SECRET` 仅 Vercel 使用。

其余项的回填位置（不要重复在 `[vars]` 和 secrets 配置同名项）：

| 位置                              | 完整变量 / 值                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/wrangler.toml` `[vars]` | `PLATFORM=cloudflare`、`AUTH_TRUST_HOST=true`、`AUTH_URL=https://tianji.gavin.pub`、`NEXT_PUBLIC_SITE_URL=https://tianji.gavin.pub`；`FEATURE_ADS=true`、`FEATURE_LLM_POLISH=false`、`FEATURE_LLM_CHAT=false`；新增 `STRIPE_TAX_ENABLED=false`。AI 开启时核对 `MINIMAX_BASE_URL` / `MINIMAX_MODEL` 与账户。                                                                                        |
| `.env.production.local` 构建期    | `NEXT_PUBLIC_SITE_URL`、`NEXT_PUBLIC_DEFAULT_LOCALE=zh`、`NEXT_PUBLIC_ADSENSE_CLIENT`、`NEXT_PUBLIC_ADSENSE_SLOT_HOME`、`NEXT_PUBLIC_ADSENSE_SLOT_REPORT_TOP`、`NEXT_PUBLIC_ADSENSE_SLOT_REPORT_BOTTOM`、`NEXT_PUBLIC_ADSENSE_SLOT_TODAY`、`NEXT_PUBLIC_ADSENSE_SLOT_LEARN`、可选 `NEXT_PUBLIC_SENTRY_DSN`；以及 `FEATURE_ADS`、`PRIVACY_CONTROLLER_NAME`、`PRIVACY_CONTACT_EMAIL`（静态法律页）。 |
| 可信终端/CI                       | `DATABASE_URL`、`DIRECT_DATABASE_URL`、导入所需配置；`STRIPE_MONTHLY_CENTS` / `STRIPE_YEARLY_CENTS` 仅产品脚本可选；Cloudflare CLI 凭据仅用于部署。                                                                                                                                                                                                                                                |

公开变量会编译进入客户端；修改后必须重新构建。Worker secrets 不会自动给本地 Next 构建提供值，按 [OpenNext 环境变量说明](https://opennext.js.org/cloudflare/howtos/env-vars)分别配置。

## 5. 首次迁移、内容导入和备份（5–10 分钟）

确认本地文件指向这次部署的独立 Neon 分支；在仓库根执行：

```bash
node --env-file=apps/web/.env.production.local --run db:deploy
node --env-file=apps/web/.env.production.local --run content:import
node --env-file=apps/web/.env.production.local node_modules/prisma/build/index.js migrate status
```

`db:deploy` 实际执行 `prisma migrate deploy`，生产不用 migrate dev/db push。验证：无 pending migration；KnowledgeRelease 发布、3826 KU/627 术语可加载；重复 import 无重复数据。启用 Neon 恢复窗口，在独立恢复分支演练，密钥和数据库备份分开保存。

## 6. Cloudflare 构建与部署（5–15 分钟）

```bash
node --env-file=apps/web/.env.production.local --run cf:build
pnpm --filter @tianji/web exec wrangler deploy --dry-run
node --env-file=apps/web/.env.production.local --run cf:deploy
pnpm --filter @tianji/web exec wrangler deployments list
pnpm --filter @tianji/web exec wrangler tail
```

本轮本地证据：cf:build 通过，实际未压缩 36040.92KiB、gzip 8655.30KiB；双语 Wrangler 专项 2 项通过；未部署云端。

验证：构建与 dry-run 退出 0、未压缩 Worker 符合 64MiB 配额（`cf:build` 已自动检查，gzip 仅记录）、部署列出新版本，日志不含出生信息/邮箱/问题/日记。记录实际 workers.dev URL 与 deployment ID 至 LAUNCH；先用隔离资源验证页面、健康检查、匿名八字和 daily。OAuth 与邮件端到端需实际 origin；正式域名绑定后用正确回调再测。`pnpm cf:preview` 是本地 Wrangler，不能作为线上 URL。Worker 大小规则已于 2026-09-04 更新，见[官方变更](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/)。

## 7. 绑定域名并回归（10–20 分钟，不含 DNS 等待）

Workers → Settings → Domains 添加 `tianji.gavin.pub` Custom Domain；或取消 `apps/web/wrangler.toml` 末尾 `[[routes]]` 的注释，再运行第 6 步 deploy。必须先有可管理的 Cloudflare zone；平台会管理域名 DNS 与证书，见[官方 Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。验证：TLS 有效且三个语言首页返回 200，Google/Stripe 配置与域名一致。

```bash
curl -fsS https://tianji.gavin.pub/api/health
curl -I https://tianji.gavin.pub/zh
curl -I https://tianji.gavin.pub/en
curl -I https://tianji.gavin.pub/zh-TW
```

按 LAUNCH 逐项测 Google/魔法链接、保存报告、daily、分享零级隐私、会员导出、订阅取消和账户删除。维护 Cron 已为 `0 3 * * *` UTC；用测试分支验证八天删除清理与无 PII 审计，生产不注入测试用户。CSP 保持 Report-Only，真实广告/CMP/支付观察至少一周且无违规后再 enforce；设置 Sentry 告警与 30 天日志保留。

## 8. Vercel 备选（15–30 分钟，不含审核）

Cloudflare 已绑定生产域名时，Vercel 先只部署 Preview，不能同时接管同一生产域名。

```bash
pnpm dlx vercel login
pnpm dlx vercel whoami
pnpm dlx vercel link
pnpm dlx vercel env add DATABASE_URL preview
pnpm dlx vercel env add DIRECT_DATABASE_URL preview
# 按 .env.example / LAUNCH 环境变量表，逐项执行：
# pnpm dlx vercel env add NAME preview
pnpm dlx vercel deploy
```

控制台开通 **Vercel Pro**，项目 Root Directory=`apps/web`，允许访问 workspace，Node 22；`apps/web/vercel.json` 已在 build 前迁移。Preview 用独立 Neon/Upstash/Resend/Stripe test/Google 客户端；`PLATFORM=vercel`，`AUTH_URL` / `NEXT_PUBLIC_SITE_URL` 为真实 Preview origin。私有 Blob → `BLOB_READ_WRITE_TOKEN`，启用 Preview 保护时 → `VERCEL_AUTOMATION_BYPASS_SECRET`，生产服务按 LAUNCH 表逐项填 Production。

验证实际 Preview URL `/api/health`、双语主流程及 PDF/PNG；将 URL 写入 LAUNCH。再完成首次 `content:import`、生产迁移和生产环境变量后执行 `pnpm dlx vercel deploy --prod`，控制台绑定 `tianji.gavin.pub`；切换时先解除另一平台的域名绑定。回滚提高上一已验收版本，数据库采取兼容迁移/恢复。

## 本轮合入功能，每项一句话

- 多档案：同账号管理多个加密出生档案，各自拥有历史和每日缓存。
- 合盘：四体系对照双人命盘，提供分章节双语解读。
- 辅助定盘：问卷排序十二时辰候选，用户可选择试排并随时改回。
- 运势日历：月热力图、年重要日期和点击日期的每日详情。
- 报告导出：八体系双语 A4 PDF 与 300dpi PNG，会员权限、配额和 24h 私有缓存。
- 繁体中文：zh-TW 路由、术语覆盖、自托管字体和报告转换。
- 生命灵数：明确算术规则、生命/生日/个人周期与姓名维度报告。
- 可选 AI 追问：去 PII 上下文、配额、本地越界拒绝与语言/长度校验，默认关闭。
- 公共内容与 SEO：27 篇双语长文、20 问 FAQ、About、牌卦历史和 627 术语，三语言静态页面/结构化数据。
- 加密日记：记录每日心情与一句话，月历/Mirror 反思统计，支持导出和删除。
- Cloudflare 适配：Neon 事务、Upstash REST、R2 私有导出、Browser Rendering 与每日 Cron。
- 本轮验收：隔离平台测试、修复公共内容与合盘语言残留、补齐跨体系证据术语，并交付逐步部署清单。

## 已知问题与公开上线前未通过项

真实服务与 Google 删除重登、OAuth consent 链接、AdSense/CMP 审核、生产 CSP enforce、备份恢复和告警仍需外部证据；Vercel 未登录、Preview 未生成。内容相似度 warning、5% 人工审稿、T-22 草稿生产流水线、T-24 知识库导出 CLI 仍未完成；About 团队/正式联系资料需 Owner 回填。参考盘导出、奇门学派差异、凯龙近似、VoiceOver 与低端实机帧率见 SUMMARY。聊天末轮调优未追加付费复测，归档有两条英文恢复提示；正常单测不调用真实 provider。依赖审计保留四项限定场景例外，安全补丁/适用条件见 [合规说明](scripts/compliance/README.md)。上述项不以本地通过代替；`launch:check --full --release` 会拒绝外部门槛未通过的发布。
