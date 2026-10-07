任务：App 后端移动端接口（Cloudflare Worker）（docs/app/00-app-plan.md §10 的 M09）。
按 §5.1、§5.3 在 apps/web 的 Worker 内实现 /api/v1/mobile/*：Apple/Google/魔法链接换令牌（访问 15 分钟、刷新 60 天一次性轮换，D1 MobileSession 表）、设备管理、增量同步（profiles/readings/journal/settings，since 游标、墓碑）、知识库 manifest 与 R2 增量包（签名校验）、chat/export/share 复用、entitlements/sync、RevenueCat webhook（若 web_pricing 已建占位则完善）。通用链接 apple-app-site-association 与 Android assetlinks.json 静态文件。接口测试。
App 施工额外约束：
- 方案文档：docs/app/00-app-plan.md（先通读 §0、§2、§3、§4，再读任务相关章节）；业务、算法、文案、隐私规则仍以 docs/00–14 为准。
- App 代码在 apps/mobile（Expo SDK 最新稳定版、Expo Router、TS strict、新架构）；复用 packages/* 而不是复制代码；Web 的行为不得被破坏（改共享包后跑 Web 全部测试）。
- 本机环境：Xcode 26 与 iOS 模拟器可用（xcrun simctl）；Android：本机暂无 Java，Owner 要求先不安装、不做 Android 原生构建；Android 相关代码照常写全（含小组件），用 TypeScript 类型检查、单测与 expo prebuild --platform android 生成工程做静态校验，原生构建与 Android 模拟器验收留到 Owner 安装 Java 之后（在 progress 里列出待验项）。
- 每个界面任务在 iOS 模拟器（和可用时的 Android 模拟器）截图存 apps/mobile/test-results/<任务>/，测试用 Jest + RNTL，端到端用 Maestro。
- 不提交签名证书、密钥、.env；Bundle ID / 包名 pub.gavin.tianji。

- Apple 后台已配置好的 ID 见 docs/app/00-app-plan.md §12，代码中的 Bundle ID、App Group、产品 ID 必须与之一致。
