# 08 · 安全与隐私

> 结合 appendix/research-compliance.md（2026-10-04 调研）的结论。本文是工程落地要求，不是法律意见；上线前建议请律师复核隐私政策与条款。

## 1. 威胁模型与原则

保护对象：出生日期/时间/地点（高唯一性个人数据）、用户提问文本（可能含隐私）、邮箱、支付状态。

原则：
1. **数据最小化**：不采集姓名（OAuth 返回的 name 仅作显示，用户可清空）、不采集宗教信仰、不采集精确实时定位。出生地只到城市级。
2. **纵深防御**：传输 TLS；静态加密（数据库厂商磁盘加密）+ **应用层字段加密**；密钥与数据分离。
3. **不外泄**：出生信息不发给任何第三方服务（没有 LLM 调用、不用外部地理 API、分享图不含生日）。
4. **可控**：用户可导出、删除；匿名模式数据不离开设备。
5. **可审计**：管理操作有审计日志；管理员看不到明文出生信息。

## 2. 字段加密

- 算法 AES-256-GCM；每次写入随机 96-bit IV；AAD 绑定表名.列名，防止密文在列间移植。
- 密钥 `FIELD_ENCRYPTION_KEYS="v2:<base64 32B>,v1:<...>"`：首项为当前写入密钥；读取按前缀版本选择。密钥仅存在 Vercel 环境变量（加密存储），不进代码库、不进日志、不进客户端。
- 轮换流程：添加新 key → 部署 → 运行 `scripts/rotate-keys.ts`（分批 500 行，事务）→ 移除旧 key → 部署。
- 密钥派生：若希望降低单密钥泄漏影响，可用 HKDF(masterKey, userId) 派生每用户子密钥（一期**采用**：`subKey = HKDF-SHA256(master, salt=userId, info='field-v1')`），这样数据库 + 主密钥泄漏仍需逐用户派生，且删除用户后其密文无意义。
- 备份：Neon 自动备份含密文；主密钥另行离线备份（Owner 保管，1Password 等）。

## 3. 日志与监控脱敏

- pino 配置 `redact: ['req.body', 'req.headers.authorization', 'req.headers.cookie', '*.birth', '*.encBirth', '*.question', '*.email']`。
- 禁止在任何 `console.log` / Sentry breadcrumb 中输出 `BirthInput`、`NormalizedBirth`、`question`。ESLint 自定义规则：`no-restricted-syntax` 禁止 `console.*` 在 `lib/`、`engine/` 下使用（用 logger）。
- Sentry `beforeSend`：删除 `request.data`、`user.email`（只保留 `user.id`），正则擦除形如 `\d{4}-\d{2}-\d{2}` 的日期字符串与 `question=` 参数。
- Vercel Analytics 只用页面级，不传自定义属性。
- Event 表的 `userHash` 用每日轮换的盐。

## 4. 认证与会话

- Auth.js v5：Google（scope `openid email profile`，非敏感，无需 OAuth 验证；做 brand verification 需 Search Console 验证域名）与 Email（Resend 魔法链接）。
- 会话 JWT 或数据库会话均可；选择**数据库会话**（便于删除账户时立即失效）。Cookie `Secure; HttpOnly; SameSite=Lax`。
- 魔法链接 15 分钟一次性；发送限流（07 §1）；链接落地页需用户点击"确认登录"按钮（防邮件安全扫描器自动消费 token）。
- 管理员：`ADMIN_EMAILS` 白名单 + `role=admin`；后台路由额外要求最近 10 分钟内重新验证（re-auth）。
- 删除账户：立即注销全部会话、撤销分享链接、Stripe 取消订阅。

## 5. Web 安全

- CSP（Report-Only 一周后 enforce）：
  `default-src 'self'; script-src 'self' 'nonce-…' https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://js.stripe.com; frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.google.com https://js.stripe.com https://checkout.stripe.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.google.com https://*.googlesyndication.com https://api.stripe.com https://*.ingest.sentry.io; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`（AdSense 实际所需域名以 Google 文档为准，施工时用 Report-Only 收集）。
- 其他头：`Strict-Transport-Security max-age=63072000; includeSubDomains; preload`、`X-Content-Type-Options nosniff`、`Referrer-Policy strict-origin-when-cross-origin`、`Permissions-Policy camera=(), microphone=(), geolocation=(self)`（geolocation 仅 Panchang 可选用，默认不请求）。
- CSRF：Server Actions 自带 Origin 校验；Route Handlers 的变更接口要求 `Content-Type: application/json` + 同源检查；Stripe webhook 验签。
- 输入：Zod 全面校验；问题文本长度 ≤ 120 字；Markdown 渲染白名单（报告内容由我们生成，但 Feedback.text 用户输入需转义）。
- 依赖：Renovate/Dependabot；`pnpm audit` 在 CI。
- 公开分享页 `noindex`；默认 `revealLevel 0`。
- 分享图生成参数 HMAC 签名，防止枚举他人数据。

## 6. 合规落地清单（来自调研）

### 6.1 年龄
- 服务条款 18+。出生档案保存时若推算年龄 < 13 → `E_AGE_RESTRICTED`，不落库、不打广告标签，设置会话 cookie `age_gate=blocked` 防止回退重填（COPPA "actual knowledge"）。13–17：允许使用但不展示个性化广告（AdSense 按 `tagForUnderAgeOfConsent` 标记）。
- 年龄门槛采用中立输入（自由输入出生年月），不用"我已满 18 岁"勾选暗示。

### 6.2 GDPR / UK GDPR
- 法律基础映射：排盘与保存 = 合同履行；账单 = 合同 + 法定；个性化广告 = 同意（TCF）；安全日志 = 合法利益；营销邮件 = 同意（一期无营销邮件）。
- 不采集任何 Art.9 特殊类别字段；解读文案不做"宗教信仰推断"表述；健康章只谈作息与"注意"，不做疾病预测。
- 隐私政策（zh/en 一致）必含 Art.13 要素：控制者身份与联系邮箱、处理目的与法律基础、接收方（Google AdSense/OAuth、Stripe、Vercel、Neon、Upstash、Resend、Sentry）、第三国传输说明（美国托管，SCC/DPF）、保留期表（见 06 §4）、权利清单（访问、更正、删除、限制、反对、可携、撤回同意、投诉）、是否存在自动化决策（说明解读为规则引擎、非法律意义上的 Art.22 决策）、Cookie 说明。
- 可携：`/api/v1/me/export` JSON。删除：7 天内完成硬删除（政策写 30 天上限）。
- 若无 EU 实体：评估是否需要 Art.27 代表（低风险、非经常性处理可能豁免，由律师判断）。

### 6.3 美国州法 / CCPA
- 页脚常驻 "Do Not Sell or Share My Personal Information / 请勿出售或共享我的个人信息" 链接 → 调起 AdSense US state regulations message；账户级开启 RDP（Restricted Data Processing）并响应 GPC 信号。
- 隐私政策加州居民权利章节。

### 6.4 同意管理
- 使用 AdSense「Privacy & messaging」：启用 European regulations message（Google 认证 CMP、TCF v2.2）与 US state regulations message。
- 一期不接任何其他追踪脚本（无 GA4/Meta Pixel），因此 Google 自带 CMP 够用；若将来加第二个脚本，需迁到通用 CMP 并接 Consent Mode v2。
- 非 EEA/UK/CH/US 地区：简洁 Cookie 提示（仅功能性 Cookie 说明），不弹同意墙。
- 用户拒绝个性化广告 → 展示非个性化广告（AdSense 自动处理）。

### 6.5 免责声明
- 页脚常驻短版；每份报告末尾完整版；首次使用弹层（需点击"我知道了"，记录到 localStorage 与用户设置）。文案（zh/en）：

> 本网站提供的八字、紫微斗数、周易、奇门遁甲、塔罗、占星等所有内容仅供娱乐、文化学习与自我反思之用，不构成医疗、心理、法律、财务、投资或其他专业建议。我们不对任何解读的准确性或结果作出保证。您基于本网站内容所作的决定由您自行负责。如涉及健康、法律、财务或心理问题，请咨询具备资质的专业人士。本服务仅面向 18 岁及以上用户。
>
> All content on this site — BaZi, Zi Wei Dou Shu, I Ching, Qi Men Dun Jia, tarot, astrology and more — is provided for entertainment, cultural learning and self-reflection only. It is not medical, psychological, legal, financial, investment or other professional advice. We make no guarantee as to the accuracy or outcome of any reading. Decisions you make based on this content are your own responsibility. For health, legal, financial or mental-health matters, consult a qualified professional. This service is intended for users aged 18 and over.

### 6.6 内容红线（AdSense 与 Stripe 风控）
- 不做健康/疾病预测、不承诺财运/复合/改运、不售卖"化解"服务、不用"必准""神准""100%"等词（05 §7 禁用词表）。
- 广告不伪装成内容按钮；不在表单页和报告正文段落中插广告。

### 6.7 第三方与托管
- Vercel **Pro** 计划（Hobby 禁止商业用途含 AdSense）。
- Google OAuth consent screen：切到 In production；隐私政策与条款链接在主域且首页可达。
- Stripe 可用；Paddle 明确禁止占星类，不作备选；Lemon Squeezy 可作备选但需先邮件确认。

### 6.8 商标提示（非法律结论）
- 「天机」在中国第 45 类已有在先注册且为行业通用词；DestinyOS 与 Bungie 的 DESTINY 系列在软件类可能有混淆风险。品牌名做成配置项（D18）正是为了保留改名空间；上线前建议做正式检索。

## 7. 安全测试与发布前检查

- [ ] 数据库 dump 中 `encBirth`/`encPlace`/`encInput` 为密文且无法用列移植解密（AAD 测试）。
- [ ] 日志采样 1000 行无日期、无邮箱、无问题文本。
- [ ] Sentry 测试事件中无 PII。
- [ ] 分享图与公开页在 `revealLevel 0` 下不含年份以外的出生信息。
- [ ] 删除账户后 7 天 cron 执行并留下审计记录（无 PII）。
- [ ] CSP 无违规报告后切 enforce。
- [ ] 速率限制与幂等生效（E2E）。
- [ ] 13 岁以下阻断与 cookie 防重填。
- [ ] 隐私政策、条款、免责声明 zh/en 页面存在且首页可达；OAuth consent screen 链接一致。
