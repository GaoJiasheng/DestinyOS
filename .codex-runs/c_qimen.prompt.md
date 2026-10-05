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
任务：T-23 知识库内容生产 · qimen。
阅读：docs/05-interpretation-engine.md §2、§7、§8（写作规范必须逐条遵守）；docs/systems/qimen.md 的「报告章节」与「知识库维度」节；packages/content 现有 schema、validate 脚本与示例 KU。
要做：在 packages/content/qimen/ 下按主题分文件编写 KU YAML，覆盖该体系文档「知识库维度」列出的全部组合（目标约 220 条），每条 zh 与 en 各自成文（不是翻译），字数、结构、语气、禁用词严格按 §8；高频 KU（用神落宫吉凶）各写 2 个变体；when 条件只用 Chart schema 中真实存在的路径与 features.* 布尔特征（先查 packages/shared 中该体系 schema 与 packages/engine 的 features）；为每章提供至少一条泛化兜底 KU（弱条件、低权重）保证任何命盘都不出现空章节。分批写入并每批运行 `pnpm content:validate`，全部通过。最后运行覆盖率检查（packages/content 的 checkCoverage 或自行对 50 个随机合法出生数据跑 engine+interpret）并把统计写入 progress 文档。
