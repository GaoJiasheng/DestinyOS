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
任务：生产站点性能排查与修复（Owner 反馈：tianji.gavin.pub 点起来很卡）。
实测（2026-10-07 00:45，curl 从新加坡）：/api/v1/health TTFB 0.6–1.9s；/zh TTFB 0.5–2.3s（一次 total 11s）；/zh/tarot TTFB 0.5–3.8s；HTML 约 395KB；响应头 x-nextjs-cache: STALE、cache-control: s-maxage=2；静态资源 cf-cache-status HIT 正常。Worker 原始体积 26.6MB / gzip 6.08MB。
目标：公共页（首页、体系落地页、学习页、法律页）全球 TTFB P75 ≤ 300ms（边缘缓存命中）；需登录的页面与 API TTFB P75 ≤ 600ms；health ≤ 150ms。
要做：
1. 用 wrangler tail / Workers Observability 与 `wrangler deploy --dry-run` 的 metafile 找出冷启动与每请求开销：顶层 import 的引擎/知识库/Prisma/WASM 初始化、知识库 bundle 是否每请求从 Assets 读取并解析、D1/KV 往返次数、next-intl 文案加载、Sentry 初始化。给出一张「请求生命周期耗时表」写入 docs/progress/PERF-WEB.md。
2. 修复方向（按收益）：(a) 公共页改为真正可缓存：合理的 s-maxage（如 1 小时）+ stale-while-revalidate，并用 Cache API / OpenNext 的增量缓存让边缘直接命中；首页「今日一瞥」等个性化块改为客户端请求或按登录态分支；(b) 延迟初始化：按路由动态 import 引擎与知识库，知识库按体系+语言分片并在 isolate 内存缓存，Prisma/D1 客户端懒加载；(c) 减小 HTML：检查 395KB 来源（内联数据、重复文案、未裁剪的知识库片段、字体 CSS），目标首页 HTML ≤ 120KB；(d) 开启 Smart Placement 评估（若 D1 往返是主因）；(e) health 端点不做重初始化。
3. 用 `wrangler deploy --dry-run` 与本地 workerd 复现并对比前后数字；在 CI 增加 Lighthouse（已有）之外的 TTFB 预算检查脚本（对生产 URL 采样 10 次，P75 超阈值失败，可用环境变量跳过）。
4. 全部测试、cf:build、冒烟通过后提交；不部署（部署由 Owner 侧执行）。
