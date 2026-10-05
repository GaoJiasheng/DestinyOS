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
任务：繁体中文 zh-TW（docs/14 B-09）。
要做：next-intl 加 zh-TW；messages/zh-TW.json 由 zh 经 opencc-js（s2twp）转换并用术语覆盖表修正（如 軟體/體系/資料 等台湾用语及命理术语繁体正字：乾坤、罗睺→羅睺、裡/裏 统一）；知识库报告文本在 interpret 输出层按 locale 做转换（加缓存），不复制 KU；路由 /zh-TW，语言切换三项，hreflang，SEO；字体子集补繁体常用字；E2E 一条验证无简体残留（用 opencc 反向检查抽样）。
