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
任务：Cloudflare Worker 瘦身（上线阻断项）。现状：Worker gzip 约 9.87MB，Workers 付费版上限 10MB，后续功能会超限。目标：gzip ≤ 6MB，并在 CI 加体积门槛（超过 8MB 失败）。
先用 esbuild metafile / wrangler --dry-run 产出体积分析，列出前 30 大模块写入 docs/progress/CF-SLIM.md，再按收益从大到小处理，可选手段（自行评估取舍并在 progress 说明）：
1. 知识库、glossary、64 卦与 78 牌数据、城市库、星表等大型数据不打进 Worker：改为构建时上传到 R2（或作为 Workers Static Assets），运行时按体系/语言按需读取并缓存到 KV 与内存。
2. Prisma（含 WASM）如占比大，评估替换为直接使用 D1 binding 的轻量查询层（如 drizzle-orm 的 d1 驱动或手写参数化 SQL）；保持现有数据模型、加密、原子 batch 语义与全部测试不变。
3. 七体系引擎与解读按路由拆分，避免每个请求加载全部；next/og 字体、three 等仅客户端或仅特定路由使用的依赖确保不进服务端包。
4. 删除未使用的依赖与 polyfill。
要求：全部单测、E2E、polish、cf:build、wrangler 冒烟通过；不部署、不写生产 secrets；提交。
