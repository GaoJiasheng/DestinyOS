任务：App 导航、引导、出生表单（docs/app/00-app-plan.md §10 的 M05）。
按 §3：引导三屏（星空→介绍→免责与18+→通知权限请求→可选填档案）；出生信息表单原生实现（公历/农历、13 档时辰滚轮+分钟、未知时辰、离线城市库精简版约 3MB、DST 提示、性别、显示名、高级选项）；多档案切换。Maestro 流程 + 截图。
App 施工额外约束：
- 方案文档：docs/app/00-app-plan.md（先通读 §0、§2、§3、§4，再读任务相关章节）；业务、算法、文案、隐私规则仍以 docs/00–14 为准。
- App 代码在 apps/mobile（Expo SDK 最新稳定版、Expo Router、TS strict、新架构）；复用 packages/* 而不是复制代码；Web 的行为不得被破坏（改共享包后跑 Web 全部测试）。
- 本机环境：Xcode 26 与 iOS 模拟器可用（xcrun simctl）；Android：本机暂无 Java，Owner 要求先不安装、不做 Android 原生构建；Android 相关代码照常写全（含小组件），用 TypeScript 类型检查、单测与 expo prebuild --platform android 生成工程做静态校验，原生构建与 Android 模拟器验收留到 Owner 安装 Java 之后（在 progress 里列出待验项）。
- 每个界面任务在 iOS 模拟器（和可用时的 Android 模拟器）截图存 apps/mobile/test-results/<任务>/，测试用 Jest + RNTL，端到端用 Maestro。
- 不提交签名证书、密钥、.env；Bundle ID / 包名 pub.gavin.tianji。

- Apple 后台已配置好的 ID 见 docs/app/00-app-plan.md §12，代码中的 Bundle ID、App Group、产品 ID 必须与之一致。
