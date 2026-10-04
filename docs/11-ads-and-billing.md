# 11 · 广告与付费

## 1. AdSense

### 1.1 账户与接入
- 申请需网站有足量原创内容：先上线 `/learn/**` 百科（64 卦、78 牌、术语、七体系介绍）与法律页，再提交审核。
- 脚本：`<Script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…" strategy="afterInteractive" crossOrigin="anonymous" />` 仅在 `FEATURE_ADS && user.plan === 'free' && !isAdminRoute && !isFormRoute` 时注入。
- `<AdSlot id slot format />` 组件：渲染 `<ins class="adsbygoogle">`，在客户端 `useEffect` 中 `push({})`；预留高度防 CLS（移动 280px、桌面 250px）；标注「广告 / Advertisement」小字；`data-full-width-responsive="true"`。
- 会员：不注入脚本、不渲染槽位；订阅状态变化后下一次请求生效。
- 13–17 岁：`(adsbygoogle=window.adsbygoogle||[]).requestNonPersonalizedAds=1` 与 `tagForUnderAgeOfConsent`。

### 1.2 广告位（固定，不超过 3 个/页）
| 页面 | 位置 | 类型 |
|---|---|---|
| 首页 | 七体系卡片之后 | 展示（响应式） |
| 报告页 | 章节 2/3 之间；章节 6/7 之间 | 展示 in-article 风格但**独立容器**，不在段落内部 |
| 每日运势 | 分领域段落与今日星象之间 | 展示 |
| 百科页 | 正文后 | 展示 |
| 结果仪式页、表单页、登录页、设置页、法律页、分享公开页 | **不投放** | |

禁止：浮动/悬浮广告、插页、内容按钮伪装、自动刷新。

### 1.3 同意
- 启用 AdSense Privacy & messaging：European regulations message（GDPR/TCF v2.2 认证 CMP）与 US state regulations message；账户级开启 RDP 并勾选响应 GPC。
- 页脚「Do Not Sell or Share My Personal Information」链接调用 `googlefc.callbackQueue.push({ CONSENT_DATA_READY: () => googlefc.showRevocationMessage() })`。
- 「隐私设置」在 `/me/settings` 提供重新打开 CMP 的入口。

### 1.4 内容合规
见 08 §6.6。另：知识库禁用词表保证不出现健康疗效承诺。

## 2. Stripe 去广告订阅

### 2.1 产品
- Product「天机会员 / DestinyOS Pro」；Price：月付、年付（年付约 10 个月价）。定价建议（Owner 最终定）：USD 2.99/月、24.99/年（竞品：astro.com PLUS 12.90/年去广告；Labyrinthos 8.99/月含更多功能；天机权益主要是去广告，定价应偏低）。
- 权益：无广告、无限历史、全部分享模板、（P1）PDF 导出、（P1）后天运势。

### 2.2 流程
1. `/pricing` → 选月/年 → `createCheckoutSessionAction` → Stripe Checkout（支持 Apple/Google Pay、信用卡；`customer_email` 预填；`allow_promotion_codes: true`；`automatic_tax: true` 需开启 Stripe Tax）。
2. 成功回到 `/me/billing?status=success`，前端轮询 `plan` 直到 webhook 落地（≤ 10s），期间显示「正在开通」。
3. 管理：Customer Portal（改付款方式、换月年、取消）。
4. Webhook 处理（幂等，按 `event.id` 去重存 Redis 24h）：
   - `checkout.session.completed` → 创建/更新 Subscription，`plan=pro`
   - `customer.subscription.updated` → 同步 status/currentPeriodEnd/cancelAtPeriodEnd/priceId；`status in (active, trialing)` → pro，否则 free
   - `customer.subscription.deleted` → free
   - `invoice.payment_failed` → 发邮件提醒（Resend），plan 暂不变（Stripe 的 past_due 宽限由 Portal 处理）
5. 删除账户 → 先 `subscriptions.cancel(immediately)`。

### 2.3 合规
- Stripe 全球禁止清单未含占星（日本/墨西哥/泰国本地账户除外）；商户描述写 "digital astrology & tarot content subscription (ad-free), entertainment purposes"。
- 条款页写明：订阅自动续费、随时取消、取消后到期停止、不退款政策（或 7 天内退款）。
- 收据与发票由 Stripe 发送。

### 2.4 备选
Lemon Squeezy（MoR，自动处理全球税）可作备选，需先邮件确认接受占星类；**Paddle 明确禁止**占星/算命类，排除。

## 3. 指标
- 广告：页 RPM、可见率（AdSense 后台）；站内记录 `ad.impression`（仅计数）。
- 订阅：转化率（pricing 访问 → checkout → 成功）、流失、MRR。
