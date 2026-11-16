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
任务：隐私政策与条款补充 App 内容（上架前置，IOS-STORE.md 列出的缺口）。
阅读：docs/08-security-privacy.md、现有 /[locale]/privacy 与 /terms 页面及其文案、apps/mobile/store/app-store/privacy-answers.md、apps/mobile 实际使用的 SDK（RevenueCat、AdMob+UMP+ATT、Sentry 是否启用、本地加密存储、推送、小组件、Sign in with Apple、Google 登录、邮箱魔法链接、追问大师 MiniMax）。
要做：在隐私政策与服务条款中新增「iOS / Android App」章节（zh、zh-TW、en 三语同步，语气与现有页面一致）：设备本地加密存储与离线计算、登录方式与会话令牌、同步、推送与小组件（本地计算，不上传出生信息）、App 内购买由 Apple/Google 处理与 RevenueCat 权益同步（不接触卡号）、广告与 ATT/UMP 同意、崩溃诊断、追问大师发给模型的仅是去标识化内容、App 内删除账号与数据导出、儿童与年龄（18+）、联系方式 privacy@gavin.pub。保持与 privacy-answers.md 一致，有出入时以代码实际行为为准并同步修正 privacy-answers.md。更新「最后更新日期」。通过 i18n:check、lint、typecheck、相关测试与 polish 法律页截图，提交，不部署、不 push。
