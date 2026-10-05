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
任务：辅助定盘（docs/14 B-03）。
要做：紫微无时辰阻断页与出生表单的「我不知道出生时间」处提供入口 /[locale]/rectify：问卷（大致时段：清晨/上午/中午/下午/傍晚/夜间/深夜/不确定；6–8 道关于性格与经历的选择题，题目按紫微命宫主星与八字时柱十神的典型差异设计，每题选项映射到对若干时辰的加权）；引擎批量排 12 个时辰的紫微与八字，按问卷打分 + 时段先验得到排序；结果页展示前 3 个候选时辰及各自的命宫主星与时柱，用户可「以此时辰试排」（档案标记 timeSource='rectified'，报告显示置信度提示，随时可改）。知识库：每个时辰候选的一句话特征 zh/en。测试：打分函数单测；E2E 一条。文档：docs/systems/rectification.md。
