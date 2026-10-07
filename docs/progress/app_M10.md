# app_M10 · App 登录、同步与账号删除

## 完成项

- Apple 原生登录；Google 授权码 + PKCE；Android Apple/Google HTTPS 中转复用 Worker 验证，不在 App 保存客户端密钥。
- 魔法链接通用链接归一到 `/auth/verify`，展示邮箱并点击确认后才消费单次令牌；成功后移除验证导航页。
- SecureStore 原子保存令牌对、绝对到期和导入选择；提前刷新、并发单次刷新、401 重试、撤销清理、离线保留。
- 登录后明确确认或跳过匿名导入；SQLCipher 事务重建归属/关联，设备引导状态保留，账号数据隔离。
- profiles/readings/journal/settings 增量同步、分页游标、上传水位、更新时间合并和终态墓碑；登录/前台/五分钟/手动触发。
- 保留档案关系/默认标记、学校偏好及报告档案版本；daily 可重算缓存留在设备，不阻塞其他资源同步。
- 设置页同步反馈、登录设备列表、撤销其他/当前设备；输入 DELETE 后复用七日账号删除并立即清理本机账号数据。
- 删除可选择同时删除反馈，提示商店订阅需在系统中取消；zh/en/zh-TW 文案均走 next-intl。
- 共用 packages/api-client 的类型与 Zod 合同；配置与文档 §12 的 Bundle ID、Team、App Group 一致。
- Jest/RNTL、真实 SQLite、Worker 签名 JWT/PKCE 和回调测试；Maestro 使用开发专用 mock 身份与档案/报告/日记/设置数据，无真实邮件。

## 未完成项 / 待验收

- 真实 Apple/Google 登录须配置公开客户端 ID、Android Apple Services ID、Worker 允许列表及服务端 Google 密钥；详见 App README。
- 正式 HTTPS 通用链接须部署 AASA/assetlinks 并用签名真机验收；Android 关联还需 Play 签名 SHA-256 指纹。
- 按 Owner 要求未安装 Java、未做 Android 原生构建或模拟器验收；待 Owner 安装 Java 后验证登录、链接、同步、设备撤销、删除及截图。
- 未部署 Worker、未推送分支；商店内购与订阅操作属于 M13。

## DESIGN-GAP 列表

- 默认本地仓库归属跟随恢复的身份；显式 null 始终表示匿名；同步游标和上传水位加密并按账号/资源隔离。
- 确认导入后撤下匿名个人数据并保留离线上传队列；仅保留设备引导、年龄门槛与非个人偏好。
- 引导/当前档案留在设备；首次账号引导占位使用 epoch 水位，让已有服务端设置优先。
- daily 是 M08 可重算设备缓存；ReadingRequest 合同排除 daily，因此仅推进缓存水位而不上传。
- 五分钟前台同步遵循现有 API 配额；离线错误提供手动重试。
- SecureStore 单记录保存令牌/绝对到期/导入选择；提前 30 秒刷新，拒绝请求最多重放一次。
- 切换身份、退出与删除暂停新同步并等待旧账号同步/令牌写入或擦除完成；等待导入选择期间回到匿名归属，清空旧同步时间。
- 原生专属文案扩展 mobile.account；设备页选为 /me/settings/devices；删除结果放账号状态以跨归属重载保留。
- Provider 控制台 ID 通过公开环境配置注入；Android Google 使用 Web 客户端与服务端密钥、双 PKCE 校验。
- Android Apple 使用 HTTPS form_post 中转；Provider 凭证置于片段并从 Router 历史移除。
- mock 恢复时先恢复诊断传输；mock 准备关闭专用开发会话的 Fast Refresh，防止语料生成重置测试身份。
- mock 身份同步回显加密本地报告快照；正式环境仍由 Worker 计算并返回报告，生产包拒绝 mock 传输。
- 完成加密年龄校验后可先处理认证链接；账号投影重载保留认证输入/导航，年龄阻断或存储错误仍拒绝显示认证页。

## 如何验证

- `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`：全部通过；生产构建 9/9 任务成功，含 iOS/Android Hermes JS 包。
- Web/共享 Vitest：134 文件、3712 项通过，2 项沿用跳过；App Jest：30 套件、153 项通过。
- Web 全量端到端各脚本通过（含多尺寸/性能、导出、聊天、日历、合盘、日记及无支付）；八字冷加载超时后 4 项复测通过。
- `pnpm --filter @tianji/mobile exec expo prebuild --platform android --no-install` 成功，仅生成工程静态校验。
- iOS Xcode 26 模拟器构建/安装成功，使用本地 ad-hoc 签名；未提交签名证书、密钥或环境文件。
- Maestro：`bash apps/mobile/scripts/m10-simulator.sh <UDID>`；Metro 用 `pnpm --filter @tianji/mobile exec expo start --port 8081`。
- Maestro 完整中英流程通过；16 张动画结束后截图已目视检查，见 `apps/mobile/test-results/M10/verification.json`。
- `pnpm licenses:check`（1716 包）及 `pnpm i18n:check` 通过；保留任务开始时的既有改动，不动 `.codex-runs/`。
