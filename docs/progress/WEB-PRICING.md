# WEB-PRICING · 月付与永久买断

## 完成项

- Owner 定价：USD 2.99/月订阅 + USD 6.99 永久买断，取消年付。
- Stripe 脚本幂等创建/核对固定价格、归档旧年付；永久 Checkout 使用 mode=payment。
- User/Subscription lifetime、Checkout ID、跨端权益到期字段及 D1 0005 迁移。
- paid + owner/customer + 价格校验后授予永久 pro；旧订阅更新、取消、到期不降级永久权益。
- /pricing、/me/billing、轮询、条款、隐私文案 zh/zh-TW/en；更新 11、LAUNCH、MORNING。
- Stripe 处理后 POST RevenueCat receipts；缺少 secret 跳过并记录，失败保留本地权益并重试。
- POST /api/v1/mobile/webhooks/revenuecat：原始体 HMAC、时效、D1 幂等、租约及权威 pro 同步。
- 回归覆盖一次性到账/未到账、延期到账、永久防降级、归属、同步重试、签名与跨端有效期。

## 未完成项 / 外部配置

- 代码任务无未完成项；生产迁移、真实产品/密钥、RevenueCat Stripe integration/pro 映射、Portal 设置由 Owner 上线时配置。
- 未执行真实付款、生产发布、远端迁移或 push；未引入依赖，未改动 .codex-runs/ 及既有未跟踪文件。
- 移动 SDK、商店商品、转移/合并账号工作流为预留范围，不在本任务实现。

## DESIGN-GAP

- Prisma diff 的 SQLite 重建表转为等价追加列/索引，保留 D1 外键、既有数据和校验触发器。
- 年付 Price 归档但保留已有订阅；Portal 年付切换由运营移除。
- 买断保留已有月付订阅，页面提示用户自行取消旧续费。
- purchase 回调参数区分新买断；已有 Pro 仍等待 lifetime 确认。
- 保存 stripeCheckoutSessionId 以追踪付款；重新读取 paid Checkout 和 line item 防止误授予。
- revenuecatProUntil 分离跨端限期权益，避免 Stripe 取消误降级。
- 两提供方共享 owner 租约与版本 guard；远端失败在本地到账后重试，不撤回权益。
- Stripe receipt 支持服务端 REVENUECAT_STRIPE_API_KEY，缺省用 REVENUECAT_SECRET_KEY。
- RevenueCat HMAC-SHA256，五分钟时效；事件依当前 subscriber pro/宽限期判断，非到期权益为永久。
- TEST 仅验证传输；未知/删除账户不创建，身份转移需后续移动工作流。

## 如何验证

- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build：通过。
- 全量 Vitest：120 文件，3650 通过、1 跳过（既有 MiniMax 真实 API smoke，需显式环境开关）；覆盖率门槛通过。
- pnpm db:deploy、pnpm db:migrate：本地 SQLite 与 Wrangler D1 迁移通过。
- pnpm i18n:check；定向计费 Vitest 24 项及迁移保留数据回归 1 项通过。
- pnpm test:m4:e2e：zh/zh-TW/en × 桌面/手机共 6 项通过，覆盖月付→取消→到期→买断→旧订阅事件。
- 检查手机定价截图；浏览器测试显式禁用真实 RevenueCat 同步，Stripe 使用本地签名 mock。
