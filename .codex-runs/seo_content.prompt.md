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
任务：公共内容与 SEO 扩充（为 AdSense 审核与自然流量）。
阅读：docs/02 §3.7、§7；docs/12 语气规范；docs/05 §8 写作规范。
要做：/learn 下每个体系（含 numerology、synastry）写 3 篇 1500–2500 字的双语入门长文（例如八字：「怎么看懂自己的四柱」「十神是什么」「大运流年怎么读」），带内部链接与结构化数据；FAQ 页（20 问，含流派说明、隐私、准不准、怎么用）；About 页正式文案（品牌故事、方法论「排盘—知识库—组文」、不用运行时 AI 编造的说明、团队与联系方式占位）；78 牌与 64 卦页补「历史与象征」段；术语页按体系分组导航；sitemap 与 hreflang 覆盖 zh/zh-TW/en；OG 图模板给公共页。内容通过禁用词检查；E2E 抽查 5 页。
