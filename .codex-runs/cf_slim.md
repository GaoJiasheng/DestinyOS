任务：Cloudflare Worker 瘦身（上线阻断项）。现状：Worker gzip 约 9.87MB，Workers 付费版上限 10MB，后续功能会超限。目标：gzip ≤ 6MB，并在 CI 加体积门槛（超过 8MB 失败）。
先用 esbuild metafile / wrangler --dry-run 产出体积分析，列出前 30 大模块写入 docs/progress/CF-SLIM.md，再按收益从大到小处理，可选手段（自行评估取舍并在 progress 说明）：
1. 知识库、glossary、64 卦与 78 牌数据、城市库、星表等大型数据不打进 Worker：改为构建时上传到 R2（或作为 Workers Static Assets），运行时按体系/语言按需读取并缓存到 KV 与内存。
2. Prisma（含 WASM）如占比大，评估替换为直接使用 D1 binding 的轻量查询层（如 drizzle-orm 的 d1 驱动或手写参数化 SQL）；保持现有数据模型、加密、原子 batch 语义与全部测试不变。
3. 七体系引擎与解读按路由拆分，避免每个请求加载全部；next/og 字体、three 等仅客户端或仅特定路由使用的依赖确保不进服务端包。
4. 删除未使用的依赖与 polyfill。
要求：全部单测、E2E、polish、cf:build、wrangler 冒烟通过；不部署、不写生产 secrets；提交。
