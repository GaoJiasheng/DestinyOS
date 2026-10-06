# CF-NATIVE

## 完成项

- Cloudflare 为主部署平台；DB、CACHE、R2、RATE_LIMITER 原生绑定。
- 已创建 D1 destinyos 与 KV destinyos-cache；资源 ID 记录在 wrangler.toml。
- Prisma SQLite + D1 driver adapter，engineType=client，无 Rust 查询引擎。
- 保持枚举值、字段名、Auth.js、加密 AAD 和现有业务路由；TEXT 枚举由 Zod 与 SQL 触发器校验。
- 四个 D1 SQL 迁移已在 local / remote 执行，复核均无待执行迁移。
- 跨模型修改使用 DB.batch，带拥有者、版本、配额及乐观并发前置检查。
- Workers 突发限流 + D1 滑动小时窗口；聊天配额、一次性 token、webhook 幂等与锁均在 D1。
- 每日运势、知识库 bundle 与分享日计数使用 KV；cron 清理过期状态并幂等回写分享计数。
- 知识库 immutable release 采用 gzip 分块，支持发布与回滚。
- 删除 Neon / Upstash / Redis 客户端、连接变量、Redis mock 与 PostgreSQL Docker 配置。
- 本地 SQLite 使用同一迁移，作为开发及 E2E 替身；新增真实 Miniflare D1 / KV 集成测试。
- 已同步数据模型、架构、双语隐私提供商文案、.env.example、LAUNCH.md、MORNING.md。
- Node 渲染 / 存储兼容路径保留，Vercel 不作为验收平台。

## 未完成项

- 旧 Neon 用户数据未搬运：未提供源连接或 dump；历史 PostgreSQL 迁移保留为归档。

## DESIGN-GAP

- SQLite 用 TEXT + Zod / SQL 触发器保留枚举；日期统一 UTC，JSON 由 Prisma SQLite 原生支持。
- D1 不支持 Prisma 交互事务：参数化 DB.batch + CHECK guard 实现原子写入。
- 原子批处理预分配 UUID，与未变更的 cuid 默认值及确定性 Reading ID 共存。
- 全系统知识库快照超过 D1 单行限制，按系统 gzip 后切分为 512KiB 块。
- 原生限流绑定只负责分钟突发；文档小时维度由 D1 滑动日志保证。
- KV 分享计数为近似统计；完成日期的 bucket 用 D1 原子标记保证幂等回写。
- health API 保留文档要求的 redis 文案键，其值现在表示 KV 可用性。
- 本地独立 smoke entry 创建 mock 登录及 renderer，记录 KV 写入证明命中，不进入生产 Worker 入口。
- 体积通过本地 workerd 目标 esbuild + gzip 测量，包含 WASM，不调用 deploy。
- SQLite 导入采用事务内分批插入与 WAL；Miniflare 压力按连接预算分批；内容审计预算为 120–240s。
- 浏览器测试使用 ESM，共享 JSON imports 带 type 属性，兼容 CJS i18n；跨包 Temporal 传递带时区 ISO 字符串，登录确认等待 hydration。
- 月度评分跳过无关月亮事件与完整本命盘构建；400ms 断言保留，DST 下逐日对照完整日报评分。
- SQLite 构建工具的多选许可使用其中 MIT / BSD 选项，无 GPL / AGPL。

## 如何验证

- pnpm install；pnpm lint；pnpm typecheck；pnpm test；pnpm build。
- pnpm test:e2e（含 polish）；pnpm cf:build；pnpm cf:smoke + pnpm test:cloudflare:e2e。
- pnpm db:migrate；pnpm db:remote；pnpm licenses:check；pnpm security:policy。
- 上述检查通过；单测 114 文件、3617 项通过，1 项既有付费外部 MiniMax smoke 按默认配置跳过。
- 全部 E2E / polish 用例通过；修复后重跑相关套件；Wrangler 最终冒烟 3 项通过。
- Worker gzip 9,873,399 bytes（9.87MB / 9.42MiB，包含 WASM），低于 10MB；无需替换 Prisma。
- 按任务要求未部署 Worker、未写生产 secrets、未 push。
