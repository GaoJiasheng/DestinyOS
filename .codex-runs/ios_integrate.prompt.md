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
任务：前后端合并（iOS 上线前置）。
现状：main 分支含 App（apps/mobile）与手机端后端接口 /api/v1/mobile/*（M09：令牌认证、同步、知识库增量包、RevenueCat webhook 等）；deploy 分支（本地分支 `deploy`，线上运行版本）含三 Worker 架构（destinyos 主入口 / destinyos-compute / destinyos-media）、性能优化、导出重做（A4 长图 + 紧凑 PDF）、美术位图、Service Worker 修复。两边各有十余个提交未互相包含。
要做：
1. 在 main 上 `git merge deploy`，解决冲突时保留双方全部功能；手机端接口必须运行在 destinyos-compute Worker 中（与 Auth/D1/KV 同处），主入口对 /api/v1/mobile/* 不做公共缓存、直接转发给 compute；RevenueCat webhook 同理。
2. D1 迁移：检查 main 上 M09/M10 新增的迁移文件与 deploy 已在线上执行到的迁移（线上已执行到 0005_lifetime_billing.sql）是否编号冲突，若冲突重新编号，确保 `wrangler d1 migrations apply destinyos --remote` 只会追加执行新迁移；只做本地验证，不执行 remote。
3. 全量检查：pnpm install、lint、typecheck、test、build、test:e2e（主流程、导出、polish 抽查）、cf:build（三个 Worker 体积门槛）、cf:multi:smoke、test:cloudflare:e2e，外加 apps/mobile 的 Jest 全量；新增一组针对 /api/v1/mobile/* 经主入口转发到 compute 的多 Worker 冒烟断言。
4. 写 docs/progress/IOS-INTEGRATE.md；提交（merge commit + 修复提交）。不部署、不 push。
