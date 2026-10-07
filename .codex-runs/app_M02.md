任务：App 引擎上 Hermes + 特效样机（docs/app/00-app-plan.md §10 的 M02）。
1) 在 iOS（与 Android 若可用）上运行 Fixture A 七体系 compute+interpret 与 computeDaily，修复 Hermes 兼容问题（crypto、Intl、TextEncoder 等），单体系 ≤ 300ms，写设备内测试。2) 按 §2.4 做 /dev/effects 样机页：星空（Skia，BSC5，陀螺仪视差，流星）、3D 天球（r3f native + expo-gl，失败退 Skia 2D）、粒子、塔罗 3D 翻牌、铜钱 3D 落下、占星轮盘入场；用 simctl 录屏并测帧率，写 docs/progress/APP-M02.md 报告每项帧率。任何一项不达标先优化到达标。
App 施工额外约束：
- 方案文档：docs/app/00-app-plan.md（先通读 §0、§2、§3、§4，再读任务相关章节）；业务、算法、文案、隐私规则仍以 docs/00–14 为准。
- App 代码在 apps/mobile（Expo SDK 最新稳定版、Expo Router、TS strict、新架构）；复用 packages/* 而不是复制代码；Web 的行为不得被破坏（改共享包后跑 Web 全部测试）。
- 本机环境：Xcode 26 与 iOS 模拟器可用（xcrun simctl）；Android：本机暂无 Java，Owner 要求先不安装、不做 Android 原生构建；Android 相关代码照常写全（含小组件），用 TypeScript 类型检查、单测与 expo prebuild --platform android 生成工程做静态校验，原生构建与 Android 模拟器验收留到 Owner 安装 Java 之后（在 progress 里列出待验项）。
- 每个界面任务在 iOS 模拟器（和可用时的 Android 模拟器）截图存 apps/mobile/test-results/<任务>/，测试用 Jest + RNTL，端到端用 Maestro。
- 不提交签名证书、密钥、.env；Bundle ID / 包名 pub.gavin.tianji。

- Apple 后台已配置好的 ID 见 docs/app/00-app-plan.md §12，代码中的 Bundle ID、App Group、产品 ID 必须与之一致。
