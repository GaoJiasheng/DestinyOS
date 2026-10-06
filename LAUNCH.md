# DestinyOS · Cloudflare 原生上线清单

主平台为 Cloudflare Workers（OpenNext）。D1、KV、R2 均使用原生 binding，无 Neon、Upstash 或数据库连接 secrets。

## 已创建资源

| Binding                  | 资源                                                |
| ------------------------ | --------------------------------------------------- |
| DB                       | destinyos / 7d4b2c61-d7dd-412f-a84e-89eb184378cc    |
| CACHE                    | destinyos-cache / 0db59c62dc5e4e85a9e1ae5eed33693f  |
| EXPORT_BUCKET            | destinyos-exports                                   |
| NEXT_INC_CACHE_R2_BUCKET | destinyos-next-cache                                |
| RATE_LIMITER             | namespace_id=1001，200/60s 突发；小时维度由 D1 实现 |
| BROWSER                  | Browser Rendering（生产 PDF/PNG 导出）              |

Account ID：9aea83b326d8175abdd136c1177637a5。配置见 apps/web/wrangler.toml。

## 本地验证

```bash
pnpm install
pnpm db:deploy
pnpm db:migrate
pnpm content:build
pnpm content:import
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm cf:build
pnpm cf:smoke
# 另一个终端；真实 Worker 首页、表单与缓存验证
pnpm test:cloudflare:e2e
```

`pnpm db:deploy` 只写本地 SQLite；`pnpm db:migrate` 应用 Wrangler 本地 D1 迁移。
`pnpm cf:build` 只构建与本地 gzip 体积检查（≤10MiB），不部署。
本地秘密放 apps/web/.dev.vars，不提交；变量清单见 .env.example。

## 发布前由 Owner 配置

Auth.js、Google OAuth、Resend、FIELD_ENCRYPTION_KEYS、Stripe、CRON_SECRET 等真实密钥通过 Workers Secrets 配置。
NEXT_PUBLIC_* 为构建期公开配置；EMAIL_FROM、ADMIN_EMAILS、Stripe price IDs、法律控制者与联系方式使用实际值。

D1 使用 `pnpm db:remote` 应用已经本地验证的 SQL；禁止生产 db push。
Worker 发布与生产 secrets 写入需要单独授权，本次任务不执行。域名为 tianji.gavin.pub。
Browser Rendering 需要可用生产配额；本地不可用时仅测试 renderer mock 与私有 R2 存取。
Cloudflare scheduled 每日 03:00 UTC 清理过期状态、撤销过期分享、硬删除账户并聚合事件。

旧 PostgreSQL 历史迁移不再执行；若旧 Neon 存在真实用户数据，需独立脱敏导入与数量核对后再切流。
本次未提供旧数据 dump，未搬运用户数据。

本次验收结果与 DESIGN-GAP 见 docs/progress/CF-NATIVE.md；交接见 MORNING.md。
