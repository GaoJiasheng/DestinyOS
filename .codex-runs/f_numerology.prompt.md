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
任务：新增体系「生命灵数」numerology（docs/14 B-10 最简项）。
要做：按 docs/04、05 的模式加入 System 枚举 numerology（西方主题）；引擎：生命灵数（生日各位相加归一，保留大师数 11/22/33）、生日数、表达数/灵魂数/人格数（可选输入英文姓名，毕达哥拉斯字母表）、个人年/月/日数、流年周期；输出 schema；知识库：1–9 与 11/22/33 的生命灵数、生日数 1–31、个人年 1–9、组合兼容性提示，zh/en 各写，约 120 条 KU，通过 validate；前端：输入页（生日自动用档案，姓名可选）、报告页（数字大字动效、九宫格可视化、年周期环）、每日运势加入「今日个人日数」一行；导航与首页卡片、学习百科页、i18n 文案、E2E 一条。写 docs/systems/numerology.md 与各文档的必要补充（允许改 docs）。
