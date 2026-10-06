# app_M09 · Worker 移动端后端

## 完成项

- 在现有 OpenNext Cloudflare Worker 中提供 `/api/v1/mobile/*` Route Handlers。
- Apple/Google JWKS 验签、issuer/audience/nonce/S256 校验；魔法链接兼容 Auth.js 单次凭证和 Web 回退。
- D1 `MobileSession` 仅保存令牌 SHA-256；访问 15 分钟，刷新 60 天原子单次轮换；设备列表、注销、退出和过期清理。
- profiles/readings/journal/settings GET/PUT 同步：签名且绑定用户/资源的 since 游标、分页、updatedAt 合并、墓碑与并发检查。
- 原生推送时间/开关、特殊日提醒、小组件主题、触感同步；共享 MobilePreferencesSchema 保持原 App 默认值。
- 数据库触发器涵盖 Web 编辑、报告保留策略、档案/日记级联删除；出生资料、输入与日记沿用现有 AES-GCM。
- 离线报告调用现有引擎重算；档案/日记/分享/聊天配额/PDF 与 A4 导出复用 Web 服务。
- 聊天 NDJSON、取消退款额；导出返回 Bearer 下载链接；账号内删除复用七日软删除流程。
- RevenueCat 即时权益刷新、HMAC/Authorization 验证、幂等、alias/TRANSFER 双向同步、到期/宽限/退款；保留有效 Stripe 权益。
- 知识库共享签名协议与 M04 客户端联通：R2 manifest、gzip 全量/upsert/remove 增量、Ed25519/SHA-256/大小校验；离线发布脚本不保存私钥。
- Apple AASA（Team D33974QQTD / pub.gavin.tianji）、Android assetlinks 配置生成、Workers Assets JSON 响应头。
- 真实 Miniflare D1/R2、签名 JWT、并发令牌、同步隔离/墓碑、知识库篡改、聊天配额和回调测试。

## 未完成项 / 待验收

- 未发布 Worker、未应用远端 D1 迁移、未上传正式 R2 包；部署使用 `0006_mobile_api.sql`。
- 生产需配置 MOBILE_GOOGLE_CLIENT_IDS、MOBILE_KNOWLEDGE_PUBLIC_KEY/MOBILE_KNOWLEDGE_KEY_ID 及 RevenueCat 服务端凭证；签名私钥仅在离线发布环境使用。
- 文档未提供 Play App Signing SHA-256 指纹：MOBILE_ANDROID_CERT_SHA256 未配置时 assetlinks 为 []；配置后构建生成真实关联。
- App 的 trustedKeys 需内置同 keyId 公钥，M10 提供 SecureStore 访问令牌回调；匿名离线仍使用内置知识库。
- Apple/Google 真机登录、RevenueCat 商店沙盒与正式通用链接需 M10/M13 联调；本次使用真实密码学校验的模拟身份。
- 本任务没有 App 界面或原生工程变更；Android 原生构建/模拟器验收仍待 Owner 安装 Java，不安装 Java。

## DESIGN-GAP 列表

- 32 字节不透明令牌、SHA-256 存储、设备 rotation、独立于 Cookie；保留墓碑至账户硬删除。
- 新增 challenge/magic/request/account 路由、DELETE sessions 的 sessionId 请求与 ID 子路由；认证限 20/小时/IP。
- OAuth 不按相同邮箱自动关联账号；已有账号使用原登录方式或魔法链接，避免跨 Provider 接管。
- 魔法凭证使用 Auth.js 相同哈希；邮件模板仍由 next-intl 提供 zh/en/zh-TW。
- 新增 Reading/JournalEntry edit 时间与 MobileSyncChange 序号，防止同毫秒变更和 Web 删除漏同步。
- 同步单批 ≤50 项、单项原子提交、客户端 edit 时间允许最多五分钟偏差；GET 游标必须在拉完分页后保存。
- 已存报告计算快照不随 PUT 修改，只改标题；新增移动离线报告保留计算日期并由服务端重算，删除 ID 不复活。
- 同步请求限 8MiB；导出下载再次验证 Bearer、账户、所有权和权益，沿用 Web 私有缓存与 24h TTL。
- 复用 EXPORT_BUCKET 的 knowledge/ 前缀；共享 M04 的签名 envelope/upsert/remove，base 0.0.0 表示全量回退；签名目录最多保留 100 包。
- User.mobileSettings 存原生偏好；vedic 主题仅影响 App；引导版本、通知权限提示、当前档案仍留设备本地。
- RevenueCat 支持控制台 Authorization；同时配置 HMAC 时两者均需通过；接受事件 ID 保留 90 天。
- 现有每日维护清理过期移动会话；熔断保留认证/回调，移动数据接口使用 JSON 错误响应。
- Android 签名指纹从构建配置生成；AASA/assetlinks 的 JSON MIME 同时配置 Next 和 Workers Assets。

## 如何验证

- `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过。
- Vitest 133 文件/3709 项通过（沿用 2 项跳过）；App Jest 23 套件/131 项通过；覆盖率 statements 99.54%、branches 98.77%。
- `pnpm --filter @tianji/mobile prebuild:android` 成功，包名 pub.gavin.tianji；未安装 Java、未做 Android 原生构建。
- `pnpm cf:build` 通过，Worker gzip 6,142,423/8,000,000 字节；JSON 通用链接文件与英文魔法链接 Web 回退实际 HTTP 通过。
- Wrangler 本地 Worker/D1 冒烟通过：Bearer 会话、设置默认值、15 分钟/60 天轮换、旧令牌失效、退出撤销。
- `pnpm licenses:check` 1714 包许可白名单通过；本地 Wrangler D1 六次迁移全部通过。
- 单独接口：`pnpm exec vitest run apps/web/test/mobile-*.test.ts apps/web/test/revenuecat-webhook.test.ts apps/web/test/worker-circuit.test.ts scripts/mobile-knowledge-release.test.ts`。
- 发布包：在离线环境提供 MOBILE_KNOWLEDGE_SIGNING_KEY，运行 `pnpm exec tsx scripts/mobile-knowledge-release.ts <version> <output> [baseline.json]`；先上传 knowledge/ 包，最后上传 manifest。
- 所有测试数据、私钥和预览存储均为临时或忽略目录；保留任务开始时既有改动，不提交 .env、密钥或 .codex-runs/。
