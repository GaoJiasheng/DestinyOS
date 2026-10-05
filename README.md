# 天机 · DestinyOS

面向海外华人的中英双语命理平台，域名 `tianji.gavin.pub`。`docs/` 是唯一需求来源。
七体系与每日运势使用确定性排盘、结构化知识库，运行时不调用 LLM。Next.js 15、React 19、TypeScript strict、next-intl、Prisma/PostgreSQL、Redis，部署目标 Vercel Pro。

当前 **T-64 本地自动验收已完成**：1201 项单测、197 项 E2E 全部通过；服务发布门槛单独记录。Vercel CLI 未登录，尚无 Preview；生产账户、内容人工审稿、CSP enforce 等待 Owner 完成。
完整任务状态与已知问题见 [进度汇总](docs/progress/SUMMARY.md)，部署和环境变量见 [LAUNCH.md](LAUNCH.md)。

## 本地运行

需要 Node.js 22、pnpm 9.15.9；连接 PostgreSQL 16 和 Redis 7，可用 Docker Compose。

```bash
pnpm install
cp .env.example apps/web/.env.local
docker compose up -d
# 填好 apps/web/.env.local 后，为根目录 CLI 加载同一配置
node --env-file=apps/web/.env.local --run db:deploy
node --env-file=apps/web/.env.local --run content:import
pnpm dev
```

Next.js 从 `apps/web/.env.local` 读配置；启动前填本地密钥，将 `AUTH_URL` 与 `NEXT_PUBLIC_SITE_URL` 改为 `http://localhost:3000`。
根目录 CLI（Prisma、内容导入）需单独注入同一环境变量；应用 `.env.local` 不会自动提供给根 CLI。
字段密钥和服务配置的生成步骤见 LAUNCH.md。匿名排盘/解读不需登录，出生档案留在本机 AES-GCM 存储；配置服务后可登录导入并保存。

- `/zh`、`/en`：首页；无前缀按 cookie、Accept-Language、默认 zh 协商。
- `/[locale]/today`：每日运势；七体系入口使用文档规定的 system 枚举。
- `/[locale]/me`：档案、历史、设置、导出删除与订阅。
- `/[locale]/learn`：体系、78 张塔罗、64 卦和术语百科。
- `/admin`：管理员后台，需白名单、数据库角色及近期重新认证。

## 检查与验收

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm i18n:check
pnpm build
pnpm exec playwright install chromium
pnpm launch:check --full
```

`launch:check --full` 实际执行 `pnpm test:e2e` 与 `pnpm perf:ci`。E2E 自动启动本地 dev server 和隔离数据库/Redis/邮件/签名 Stripe 测试服务；无需真实付款密钥。
Lighthouse 先验证中英双语每日页真实内容与离线计算，再使用生产构建审计首页、today、八字完整报告各 3 次，移动端最差 Performance ≥85、Accessibility ≥90。
本次九次移动审计的最差 Performance：首页 / today / 八字完整报告为 99 / 88 / 100，Accessibility 为 99 / 100 / 100。
不要并发运行 dev、build 和性能审计，它们共用 `apps/web/.next`；截图和性能结果分别在 `test-results/`、`.lighthouseci/reports/`。

`pnpm launch:check` 是快速质量/隐私/部署产物探针，浏览器项会显示未验证；JSON 记录在 `.launch-check/results.json`。
`pnpm launch:check --full --release` 还将未完成的外部发布门槛计为失败，不能把本地通过等同于公开上线。

附加命令：`pnpm licenses:check`、`pnpm security:policy`、`pnpm audit`、`pnpm perf:budgets`、`pnpm engine:bundle`。
依赖 audit 例外与安全补丁依据见 [合规操作说明](scripts/compliance/README.md)；不引入 GPL/AGPL 依赖。

## 内容与目录

- `apps/web`：响应式界面、认证、账户、分享、支付、广告、百科与后台。
- `packages/engine`：七体系及 daily 纯 TypeScript 排盘，黄金 fixtures 与浏览器验证。
- `packages/interpret`：知识命中、组合、术语与可读性，不依赖数据库或网络。
- `packages/content`：双语 YAML、schema、校验、编译；3451 KU、612 术语。
- `packages/shared`：品牌单一配置、枚举、schema；`packages/config`：严格 TS、ESLint、设计 token。
- `prisma`：模型、版本化迁移、加密扩展；`scripts`：数据资源、内容导入、性能、安全与上线检查。

`worker:build` 生成带内容哈希的匿名每日 Worker；web dev/build 自动生成，根 build 在 Turbo 缓存恢复前保证资源存在。

`content:import` 校验编译后原子导入 KU/不可变 Release，可安全重复；冲突拒绝覆盖，需增加单元与 Release 版本。
旧报告保留生成时版本；新报告使用已发布数据库 Release，数据库不可用时回退构建知识库。
[DESIGN-GAP 索引](DESIGN-GAPS.md) 汇总代码中的未规定细节；内容相似度警告和人工审核状态保留可见。
