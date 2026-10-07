任务：把数据层迁移到 Cloudflare 原生服务（Owner 已决定），并让 Cloudflare 成为主部署平台。
现状：Prisma + PostgreSQL（Neon）、Upstash Redis（限流、每日运势缓存、魔法链接 token、webhook 去重、计数器）、R2 已开通（桶 destinyos-exports、destinyos-next-cache 已创建）、Cloudflare 账号已登录 wrangler（account_id 9aea83b326d8175abdd136c1177637a5）。
要做：
1. 数据库改为 Cloudflare D1（SQLite）：用 wrangler 创建 D1 数据库 `destinyos`（若已存在复用），把 database_id 写入 apps/web/wrangler.toml 的 [[d1_databases]] binding `DB`；Prisma 改 provider=sqlite + @prisma/adapter-d1（driverAdapters），处理 SQLite 不支持的类型：枚举改为 String + Zod/TS 联合类型校验（保持现有枚举值不变）、Json 字段、BigInt、@db.Date、DateTime、数组、默认值、索引与 sort；Auth.js 适配器在 D1 下可用；加密字段逻辑不变。迁移：用 `prisma migrate diff` 生成 SQL 放 apps/web/migrations/（D1 迁移格式），`wrangler d1 migrations apply destinyos --local` 与 `--remote` 都要跑通（remote 由你执行，账号已登录）。
2. Redis 替换：限流改用 Workers Rate Limiting binding（[[unsafe.bindings]] type=ratelimit 或当前 wrangler 推荐写法）不可满足的分维度限额用 D1 计数表或 Durable Object 实现；每日运势缓存、知识库 bundle 缓存、分享计数用 KV（创建 namespace `destinyos-cache` 并绑定 `CACHE`）；魔法链接 token、webhook 幂等、聊天配额等需要强一致的用 D1 表（带过期时间与定时清理）。保留一个本地开发与测试可用的内存/SQLite 实现。
3. 平台抽象：Cloudflare 为主路径；Vercel 路径可以保留但不再是验收要求（若保留成本高可删除并在 progress 说明）。去掉 Neon/Upstash 依赖与环境变量（.env.example、LAUNCH.md、MORNING.md 同步更新）。
4. 测试：全部单测、E2E、polish 套件在新数据层上通过（本地用 wrangler/miniflare 的 D1 与 KV 或等价测试替身）；`pnpm cf:build` 通过；Worker gzip 体积报告（必须 ≤ 10MB，若 Prisma 引擎导致超限，改用 Prisma 的 wasm/edge 客户端或评估 drizzle-orm 替换 Prisma 并说明理由）。
5. 在本地用 `wrangler dev` 冒烟：首页、出生表单→八字报告持久化（登录用 mock）、每日运势缓存命中、限流 429、导出（Browser Rendering 本地不可用则 mock）。
6. 不要执行 `wrangler deploy`，不要写入任何生产 secrets。提交，并更新 docs/progress/CF-NATIVE.md 与 docs/06-data-model.md、docs/09-architecture.md 的相应章节。
