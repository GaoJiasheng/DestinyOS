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
App 施工额外约束：
- 方案文档：docs/app/00-app-plan.md（先通读 §0、§2、§3、§4，再读任务相关章节）；业务、算法、文案、隐私规则仍以 docs/00–14 为准。
- App 代码在 apps/mobile（Expo SDK 最新稳定版、Expo Router、TS strict、新架构）；复用 packages/* 而不是复制代码；Web 的行为不得被破坏（改共享包后跑 Web 全部测试）。
- 本机环境：Xcode 26 与 iOS 模拟器可用（xcrun simctl）；Android：本机暂无 Java，Owner 要求先不安装、不做 Android 原生构建；Android 相关代码照常写全（含小组件），用 TypeScript 类型检查、单测与 expo prebuild --platform android 生成工程做静态校验，原生构建与 Android 模拟器验收留到 Owner 安装 Java 之后（在 progress 里列出待验项）。
- 每个界面任务在 iOS 模拟器（和可用时的 Android 模拟器）截图存 apps/mobile/test-results/<任务>/，测试用 Jest + RNTL，端到端用 Maestro。
- 不提交签名证书、密钥、.env；Bundle ID / 包名 pub.gavin.tianji。

- Apple 后台已配置好的 ID 见 docs/app/00-app-plan.md §12，代码中的 Bundle ID、App Group、产品 ID 必须与之一致。
任务：App Store 上架资料定稿（只产出文件，不登录任何后台）。
阅读：docs/app/00-app-plan.md §7、§12，docs/app/RELEASE.md，apps/mobile/store/，docs/08-security-privacy.md，现有隐私政策页文案。
要做（产出到 apps/mobile/store/app-store/）：
1. 三语言（en-US 主语言、zh-Hans、zh-Hant）的：App 名称（≤30 字符，英文名已定为 "DestinyOS: BaZi & Tarot"，中文请给 3 个候选并标注首选）、副标题（≤30）、宣传文本（≤170）、描述（≤4000，突出 §7 的差异点：七大中西体系、离线排盘引擎、三语、真实星空、无运行时 AI 编造）、关键词（≤100 字符，逗号分隔，不重复名称中的词）、新功能说明、支持 URL（https://tianji.gavin.pub/{locale}/faq 或现有页面）、营销 URL、隐私政策 URL。每项附字符数校验。
2. 截图：6.9 寸（1320×2868）与 6.5 寸（1284×2778）各 6–8 张、三种语言，使用 iOS 模拟器 Release 构建实拍并套品牌模板（鎏金天象风，文案用对应语言，不出现测试数据痕迹与调试横幅）；另出 2 张内购审核截图（会员页 + 购买确认态，1290 宽即可）。放 screenshots/{locale}/{size}/。
3. App 隐私问卷答案：逐项列出数据类型、是否收集、用途、是否关联用户、是否用于跟踪（依据代码实际使用的 SDK：RevenueCat、AdMob+UMP+ATT、Sentry 是否启用、邮件、Google/Apple 登录、本地加密存储），输出 privacy-answers.md，格式按 App Store Connect 问卷的实际题目顺序，方便 Owner 照填。
4. 审核备注 review-notes.md：演示账号说明（若需登录才能体验的功能）、内购说明、AI 生成内容说明、内容免责、4.3 差异化说明；以及年龄分级说明（已在后台设为 18+）。
5. 自动校验脚本 scripts/store-check.ts：检查字符数、截图尺寸、文件齐全。
6. 写 docs/progress/IOS-STORE.md；提交，不 push。
