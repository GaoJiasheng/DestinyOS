你是 DestinyOS（天机）项目的施工工程师。仓库根目录的 docs/ 是唯一需求来源，先读 docs/00-overview.md 全文，再读任务指定的文档节。
通用约束：
- 技术栈与目录结构严格按 docs/09-architecture.md；枚举值、字段名、路由、文案键以文档为准，不得更名。
- 不引入 AGPL/GPL 依赖。TypeScript strict，禁止 any 逃逸。
- 用户可见文案一律经 next-intl，zh 与 en 必须同时提供。
- 文档未覆盖的细节选最主流做法，并在代码中加 `// DESIGN-GAP: <说明>` 注释。
- 不要修改 docs/ 目录（除非任务明确要求）。不要动 .codex-runs/。
- 完成后必须实际运行 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（若有）、`pnpm build`，全部通过才算完成；把失败修到通过。
- 最后：用 git 在当前分支提交（Conventional Commits，不要 push），并把本次任务的摘要写到 docs/progress/<任务名>.md：完成项、未完成项、DESIGN-GAP 列表、如何验证。摘要控制在 60 行内。
- 全程不要询问，自行决策。网络可用，可以安装 npm 包。
任务：App 商店素材与提审准备（docs/app/00-app-plan.md §10 的 M15）。
用模拟器自动截图（6.9 寸、6.5 寸 iPhone，Android 手机）各 6 张并套品牌模板；中英（及繁中）商店标题、副标题、描述、关键词；隐私营养标签与 Google 数据安全表草稿；PrivacyInfo.xcprivacy；eas.json 与 app.config 的生产配置（不含密钥）；写 docs/app/RELEASE.md：Owner 在 App Store Connect、Play Console、RevenueCat、AdMob 需要做的每一步与审核备注文案（强调 §7 的差异点）。
App 施工额外约束：
- 方案文档：docs/app/00-app-plan.md（先通读 §0、§2、§3、§4，再读任务相关章节）；业务、算法、文案、隐私规则仍以 docs/00–14 为准。
- App 代码在 apps/mobile（Expo SDK 最新稳定版、Expo Router、TS strict、新架构）；复用 packages/* 而不是复制代码；Web 的行为不得被破坏（改共享包后跑 Web 全部测试）。
- 本机环境：Xcode 26 与 iOS 模拟器可用（xcrun simctl）；Android：本机暂无 Java，Owner 要求先不安装、不做 Android 原生构建；Android 相关代码照常写全（含小组件），用 TypeScript 类型检查、单测与 expo prebuild --platform android 生成工程做静态校验，原生构建与 Android 模拟器验收留到 Owner 安装 Java 之后（在 progress 里列出待验项）。
- 每个界面任务在 iOS 模拟器（和可用时的 Android 模拟器）截图存 apps/mobile/test-results/<任务>/，测试用 Jest + RNTL，端到端用 Maestro。
- 不提交签名证书、密钥、.env；Bundle ID / 包名 pub.gavin.tianji。

- Apple 后台已配置好的 ID 见 docs/app/00-app-plan.md §12，代码中的 Bundle ID、App Group、产品 ID 必须与之一致。
