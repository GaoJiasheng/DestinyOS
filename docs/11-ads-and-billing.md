# 11 · 广告与付费

## 1. AdSense

### 1.1 账户与接入

- 申请需网站有足量原创内容：先上线 `/learn/**` 百科（64 卦、78 牌、术语、七体系介绍）与法律页，再提交审核。
- 脚本：`<Script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…" strategy="afterInteractive" crossOrigin="anonymous" />` 仅在 `FEATURE_ADS && user.plan === 'free' && !isAdminRoute && !isFormRoute` 时注入。
- `<AdSlot id slot format />` 组件：渲染 `<ins class="adsbygoogle">`，在客户端 `useEffect` 中 `push({})`；预留高度防 CLS（移动 280px、桌面 250px）；标注「广告 / Advertisement」小字；`data-full-width-responsive="true"`。
- 会员：不注入脚本、不渲染槽位；订阅状态变化后下一次请求生效。
- 13–17 岁：`(adsbygoogle=window.adsbygoogle||[]).requestNonPersonalizedAds=1` 与 `tagForUnderAgeOfConsent`。

### 1.2 广告位（固定，不超过 3 个/页）

| 页面                                                   | 位置                         | 类型                                             |
| ------------------------------------------------------ | ---------------------------- | ------------------------------------------------ |
| 首页                                                   | 七体系卡片之后               | 展示（响应式）                                   |
| 报告页                                                 | 章节 2/3 之间；章节 6/7 之间 | 展示 in-article 风格但**独立容器**，不在段落内部 |
| 每日运势                                               | 分领域段落与今日星象之间     | 展示                                             |
| 百科页                                                 | 正文后                       | 展示                                             |
| 结果仪式页、表单页、登录页、设置页、法律页、分享公开页 | **不投放**                   |                                                  |

禁止：浮动/悬浮广告、插页、内容按钮伪装、自动刷新。

### 1.3 同意

- 启用 AdSense Privacy & messaging：European regulations message（GDPR/TCF v2.2 认证 CMP）与 US state regulations message；账户级开启 RDP 并勾选响应 GPC。
- 页脚「Do Not Sell or Share My Personal Information」链接调用 `googlefc.callbackQueue.push({ CONSENT_DATA_READY: () => googlefc.showRevocationMessage() })`。
- 「隐私设置」在 `/me/settings` 提供重新打开 CMP 的入口。

### 1.4 内容合规

见 08 §6.6。另：知识库禁用词表保证不出现健康疗效承诺。

## 2. App 会员与保留的 Stripe 支付

### 2.0 网站暂不收款（Owner 最新决定）

- `FEATURE_WEB_PAYMENTS=false` 为默认值；覆盖本章历史 Stripe 默认开放流程。网站 `/pricing` 与 `/me/billing` 介绍去广告、无限历史、全部分享模板、PDF 导出等现有权益，显示「2.99 美元/月 或 6.99 美元永久」，主按钮「在 App 中开通」。
- 桌面显示 App Store / Google Play 下载链接与本地生成的二维码；移动浏览器点击主按钮直接进入对应商店。`NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_PLAY_STORE_URL` 为空或无效时显示「即将上架」。支持 zh/zh-TW/en。
- 关闭时 Stripe 路由返回 404；购买/Portal Action 拒绝执行，页面不加载 Stripe 控件或 SDK，无 Stripe 脚本。所有 Stripe 环境变量均非必需；两档产品创建脚本与支付实现保留，只有显式开启后恢复。
- RevenueCat `pro` 是 App 权益来源，App SDK 的 `appUserID` 与网页登录的 `User.id` 完全一致。登录用户「刷新会员状态」查询 REST 当前权益；缺失 `REVENUECAT_SECRET_KEY` 时跳过，不修改权益。Webhook 继续 HMAC 验签、D1 幂等和按用户串行同步。
- RevenueCat 无限期权益设置 lifetime；订阅按到期/宽限期判断；退款撤销非消耗型永久权益时可降级，仍有效的历史 Stripe 订阅/买断不受影响。


### 2.1 产品（Owner 已决定）

- Product「天机会员 / DestinyOS Pro」；仅两档：**USD 2.99/月订阅**与 **USD 6.99 永久买断（一次性付款）**，取消年付。
- `STRIPE_PRICE_MONTHLY` 为 recurring month price（299 美分），`STRIPE_PRICE_LIFETIME` 为 one-time price（699 美分）。脚本 `pnpm stripe:products` 幂等创建、核对固定价格并归档旧年付 Price；不取消已有年付订阅。Customer Portal 移除年付切换。
- 权益：无广告、无限历史、全部分享模板、PDF 导出；后天运势为下一阶段计划。永久会员无到期日。
- D1 0005 迁移依据 Prisma diff 生成结果采用等价追加列/索引，避免重建 User/Subscription 删除外键关联数据或校验触发器。User 与 Subscription 新增 `lifetime: Boolean = false`；Subscription 保存 `stripeCheckoutSessionId`。User 的 `revenuecatProUntil` 保存跨端限期权益；不改变 `plan=free|pro` 枚举。

### 2.2 流程

1. `/pricing` → 选 monthly/lifetime → `createCheckoutSessionAction` → Stripe Checkout；月付 `mode=subscription`，买断 `mode=payment`，买断新客户 `customer_creation=always`。支持 Apple/Google Pay、信用卡、优惠码；Stripe Tax 配置完成后才开启自动税。
2. 成功回到 `/me/billing?status=success&purchase=monthly|lifetime`，前端轮询新鲜数据库权益（≤10s），期间显示「正在开通」。永久买断等待 `lifetime=true`，已有 Pro 不提前显示买断成功。
3. Customer Portal 管理月付的付款方式和取消续费。永久会员显示「永久会员 · 无到期日，无自动续费」，纯买断不显示订阅续费项。已有月付可以购买永久会员，但须自行在 Portal 取消旧续费，页面明确提示。
4. Webhook（按 `event.id` 在 D1 EphemeralState 去重24h；事件与用户租约、版本条件、原子批次保护写入）：
   - `checkout.session.completed`（及延迟到账 `checkout.session.async_payment_succeeded`）：订阅同步 Stripe 当前状态；买断重新读取 Checkout、校验 paid、owner/customer、lifetime metadata 与 allowlisted line item，授予 `plan=pro`、User/Subscription `lifetime=true`。
   - `customer.subscription.updated/deleted`：同步 status/currentPeriodEnd/cancelAtPeriodEnd/priceId；active/trialing → pro，其余 → free，**但 lifetime 用户或仍有 RevenueCat 限期权益的用户保持 pro**。订阅事件不得清除 lifetime。
   - `invoice.payment_failed`：发本地化提醒邮件，plan 暂不变。
   - 每次购买/订阅状态处理后调用 RevenueCat REST `POST /v1/receipts`，`X-Platform=stripe`，`app_user_id=User.id`；订阅 `fetch_token=sub_…`，一次性付款 `fetch_token=cs_…`。不传出生信息。`REVENUECAT_SECRET_KEY` 缺失时跳过并记录脱敏 warning；调用失败返回503并释放事件锁供重试，已到账权益保留。
5. 删除账户先立即取消尚未结束的 Stripe 订阅；任何重试不得恢复已删除账户。

### 2.2.1 跨端预留（RevenueCat）

- Stripe integration 配置在 RevenueCat 中，两个 Stripe 价格均映射 entitlement **`pro`**；未来客户端以同一 `User.id` 登录 SDK。
- 服务端环境：`REVENUECAT_SECRET_KEY`；Stripe receipt 如需对应 app public key，配置服务端 `REVENUECAT_STRIPE_API_KEY`（缺省使用 secret key）。这些变量不对浏览器公开。
- `POST /api/v1/mobile/webhooks/revenuecat`：`REVENUECAT_WEBHOOK_SECRET` 校验 RevenueCat HMAC-SHA256 签名（`X-RevenueCat-Webhook-Signature: t=…,v1=…`，原始请求体、常量时间比较、5分钟时间容差），验签后才读写 D1。
- 按 event.id 去重24h、失败可重试；读取 `GET /v1/subscribers/{User.id}` 当前 `entitlements.pro`，按 expires_date/grace_period_expires_date 判断有效，非到期权益更新 plan=pro，无到期权益设置 lifetime。取消/迟到事件依当前状态判断；到期不覆盖历史 Stripe 买断或仍有效的 Stripe 订阅；RevenueCat 永久权益撤销会清除对应 lifetime。
- TEST 验证传输；尚未实现移动 SDK、商店商品、转移/合并账号工作流。未知/已删除 User.id 不创建账户。
- API 与签名规则：[Stripe purchase import](https://www.revenuecat.com/docs/web/integrations/stripe/track-external-purchases)、[REST transactions](https://www.revenuecat.com/docs/api-v1/transactions)、[Webhook verification](https://www.revenuecat.com/docs/integrations/webhooks)。

### 2.3 合规

- Stripe 全球禁止清单未含占星（日本/墨西哥/泰国本地账户除外）；商户描述写 "digital astrology & tarot content subscription (ad-free), entertainment purposes"。
- 条款页写明：月付订阅自动续费、随时取消、取消后到期停止；永久买断一次性付款、无到期日且不受订阅事件影响；付款不退款（法律强制退款或撤回权除外）。
- 收据与发票由 Stripe 发送。

### 2.4 备选

Lemon Squeezy（MoR，自动处理全球税）可作备选，需先邮件确认接受占星类；**Paddle 明确禁止**占星/算命类，排除。

## 3. 指标

- 广告：页 RPM、可见率（AdSense 后台）；站内记录 `ad.impression`（仅计数）。
- 订阅：转化率（pricing 访问 → checkout → 成功）、流失、MRR。


## 4. Cloudflare 费用熔断

- Workers `[limits] cpu_ms=5000`：本地实际 OG Route Handler 每条 100 次、轮换 zh/zh-TW/en，`process.cpuUsage()` user+system（毫秒），并读取完整 PNG body。分享 story P99 **742.541ms**（最大 863.002），分享 landscape **340.708ms**，daily **367.924ms**；最慢样本的三倍为 2227.623ms，所以 `max(5000, ceil(P99×3))=5000`。CPU 与墙钟延迟不混用。PDF/PNG 的浏览器渲染在 BROWSER 服务，AI 等待在外部服务；这些延迟不计入 Worker CPU。
- 该本地 Node 样本替换 quota/auth/分享数据库读取与请求翻译上下文，保留真实签名、布局、字体、Satori/PNG 核心，不等同生产 workerd P99。发布后 Owner 用 Observability 慢路由 CPU P99 复核相同公式；重测：`RUN_CF_CPU_BENCHMARK=1 pnpm exec vitest run apps/web/test/route-cpu.test.ts`，结果 `/tmp/destinyos-route-cpu.json`。
- 每日 `0 3 * * *` 保留；新增每小时 `0 * * * *`，进入鉴权 `/api/v1/cron/cost-circuit`。GraphQL `workersInvocationsAdaptive.sum.requests/cpuTimeUs` 聚合整个账户当计费月，CPU 微秒除以 1000；按天非重叠切片，不以 P99 乘请求数估算 CPU。
- `CF_ANALYTICS_TOKEN` 为 Worker secret（Owner 将 CLI 的 `CLOUDFLARE_API_TOKEN` 同值写入，需 Account Analytics Read）；`CF_ANALYTICS_ACCOUNT_ID` 与 `CF_BILLING_CYCLE_DAY` 非秘密。缺配置跳过；API 错误不改变当前熔断状态。周期默认为每月 1 日 UTC，Owner 按实际账单周年日配置，短月份取最后一天。
- 包含额度 1000 万请求、3000 万 CPU 毫秒；任一 **超过 90%** 在 KV 写 `circuit=open`；两者均 **低于 80%** 或新周期且未再次超阈值恢复。KV 状态不设 TTL；Cron 使用 D1 租约避免并发检查。
- Worker 在 OpenNext/DB 之前返回不含 JS、广告的三语言静态 503 维护页；包括 PDF/PNG 导出、追问、分享图路由。仅 admin、登录、Auth API、健康、两项 Cron 与 RevenueCat webhook 保留可达，便于恢复和同步。
- `/admin/config` 新增 `circuit.mode=auto|open|closed`，分别自动、手动维护、手动恢复；写入审计与 KV，明确覆盖自动状态。手动恢复后 Cron 仍监控；选择 auto 重新应用自动保护。
- 开启后经 Email Service 给 `ADMIN_EMAILS` 发告警；成功收件人每计费周期去重，失败收件人下次 Cron 重试。KV 最终一致与 Analytics 采样/延迟意味着保护不是 Cloudflare 硬性账单上限；静态维护请求仍可能计费，WAF 在 Worker 前减量。
- WAF 脚本仅交付不执行：gavin.pub 区域，tianji.gavin.pub 同 IP 10 秒超过 60 动态请求阻断 60 秒，静态路径排除。Cloudflare 规则要求含 `cf.colo.id`，按边缘位置计数；支持参数依实际 Zone 套餐，失败不会放宽限制。Owner 命令见 LAUNCH.md。
- 官方接口：[Workers GraphQL](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/)、[CPU 聚合字段](https://github.com/cloudflare/skills/blob/main/skills/cloudflare/references/graphql-api/api.md)、[限流 API](https://developers.cloudflare.com/waf/rate-limiting-rules/create-api/)。
