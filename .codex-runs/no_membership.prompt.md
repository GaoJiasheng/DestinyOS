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
任务：首版关闭会员与付费（Owner 决定：先不接付费、不接广告，把基础功能做好）。
要做：
1. 新增总开关 FEATURE_MEMBERSHIP（Web 服务端与构建期公开变量、App 的 EXPO_PUBLIC_FEATURE_MEMBERSHIP），默认 false。关闭时：
   - Web：隐藏导航/页脚/设置/报告页/导出面板里所有会员、定价、去广告、「在 App 中开通」入口；/pricing 与 /me/billing 返回 404（或重定向到首页）；权益判断一律按免费用户但不展示任何付费提示；与会员挂钩的限制（历史 50 条、分享模板、PDF 导出等）首版对所有登录用户放开为会员级别，避免出现「需要会员」的死胡同。
   - App：隐藏会员 Tab/入口、购买与恢复购买按钮、「即将开放」文案；RevenueCat SDK 不初始化、不打包原生模块（与现有 AdMob 缺省处理方式一致）；同样放开原会员限制。
   - 广告：Web 与 App 在未配置真实 ID 时已不展示，确认首版完全无广告位占位。
2. 文案、i18n（zh/zh-TW/en）同步删除不再出现的入口文案引用，i18n:check 通过。
3. 商店资料：更新 apps/mobile/store/app-store/ 的描述、审核备注（说明首版无 App 内购买、无广告）、隐私问卷答案（去掉 RevenueCat/AdMob/ATT 相关项，以实际打包的 SDK 为准）；若商店截图里出现会员相关界面则重拍；store-check 去掉 IAP 截图硬性要求（会员开关关闭时）。
4. 隐私政策中 App 内购买与广告相关表述改为「目前不提供，将来提供时会更新本政策」。
5. 全部检查：lint、typecheck、Web 与 App 全量单测、e2e 主流程与 polish、cf:build、cf:multi:smoke、iOS Release 模拟器构建 + Maestro 主流程；提交，不部署、不 push。写 docs/progress/NO-MEMBERSHIP.md。
