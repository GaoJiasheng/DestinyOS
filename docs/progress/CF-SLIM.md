# CF-SLIM

## 体积分析

Wrangler `deploy --dry-run` 的真实上传模块逐个 gzip（JS/WASM/字体，不计 map）；OpenNext 内层 metafile 展开服务端贡献，保留外层 middleware/bootstrap。基线 **9,983,131 bytes** → 最终 **5,899,502 bytes**（raw 25,855,708；减少 **40.9%**，满足 ≤6,000,000）。以下为基线前 30 大模块，按未压缩贡献排序；Webpack chunk / middleware 为聚合模块。

| # | 模块 | bytes |
|---|---|---:|
| 1 | `.next/server/chunks/9181.js` | 3262629 |
| 2 | `playwright-core/lib/coreBundle.js` | 2655606 |
| 3 | `.next/server/chunks/4546.js` | 2082405 |
| 4 | `.next/server/chunks/5049.js` | 2081972 |
| 5 | `next/dist/server/load-manifest.external.js` | 2074639 |
| 6 | `playwright-core/lib/utilsBundle.js` | 2022661 |
| 7 | `query_compiler_bg.wasm` | 1871962 |
| 8 | `.open-next/middleware/handler.mjs` | 1568912 |
| 9 | `.next/server/instrumentation.js` | 1552647 |
| 10 | `.next/server/chunks/6166.js` | 1545542 |
| 11 | `resvg.wasm` | 1378357 |
| 12 | `.open-next/server-functions/default/apps/web/index.mjs` | 1237647 |
| 13 | `.next/server/chunks/7461.js` | 1235483 |
| 14 | `.next/server/chunks/5836.js` | 1070716 |
| 15 | `geo-tz/data/timezones-1970.geojson.index.json` | 700142 |
| 16 | `.next/server/chunks/7922.js` | 675606 |
| 17 | `.next/server/chunks/2614.js` | 618239 |
| 18 | `.next/server/chunks/1458.js` | 616770 |
| 19 | `.next/server/chunks/6974.js` | 616765 |
| 20 | `.next/server/chunks/1484.js` | 596586 |
| 21 | `next/dist/compiled/next-server/app-page.runtime.prod.js` | 569851 |
| 22 | `.next/server/chunks/2851.js` | 567188 |
| 23 | `next/dist/compiled/@vercel/og/index.edge.js` | 537301 |
| 24 | `.next/server/chunks/8855.js` | 517011 |
| 25 | `.next/server/chunks/1977.js` | 517008 |
| 26 | `.next/server/chunks/6021.js` | 484109 |
| 27 | `.next/server/chunks/9359.js` | 339505 |
| 28 | `.next/server/chunks/8075.js` | 339491 |
| 29 | `.next/server/chunks/7772.js` | 320310 |
| 30 | `.next/server/chunks/6002.js` | 303149 |

## 完成项与取舍

- 修复 Worker 别名，排除 Playwright、geo-tz、Chromium、SQLite、Blob、pino 等 Node 适配器；合并 lunar/astronomy/Temporal/OpenCC/Zod/Sentry 的 SSR/RSC 重复依赖，隔离 Node/Worker 构建缓存。两轮 gzip 7,868,856 → 6,198,084 bytes。
- zh/en/zh-TW glossary 移到 Static Assets，按语言读取，内容 SHA256 隔离 KV 与内存缓存；知识库、卦/牌、城市、星表沿用已有 Assets 路径。
- Prisma query compiler WASM gzip 721,221 bytes：保留现有 D1、模型、加密及原子 batch；未替换 ORM。保留 OG WASM/字体并实测三语言 PNG。
- 单 Worker 内路由动态 import 仍计入总上传体积，未增加多 Worker 路由拆分；保留本地 Node 平台所需依赖。无需新增 R2 上传或生产 secrets。
- CI 强制 gzip ≤8,000,000 bytes，拒绝 Node 依赖回流；上传 size/modules/metafile/log 分析产物；门槛边界及缓存故障路径新增 8 项单测。

**未完成项：** 无；不部署、不 push，生产 secrets 未写入。原有付费外部 MiniMax 单测按仓库默认条件跳过。

## DESIGN-GAP

- Webpack 请求别名、RSC/SSR CommonJS 共享、Sentry workerd SDK 显式追踪，以及按平台分区构建缓存。
- 公共 glossary 使用 Assets + 内容哈希 KV（TTL 3600s）+ isolate 内存；KV 损坏/故障回退，失败读取可重试，构建阶段读取追踪文件。
- 十进制 MB 门槛、真实 Wrangler dry-run 测量、内外层 metafile 排名、Node 依赖回流检查及 CI 分析附件。
- 仅本地 smoke 入口查询 glossary KV 键；实际时区资源与 OG PNG 回归验证；生产入口不包含测试路由。

## 如何验证

- 已实际通过：`pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（117 文件，3635 通过；原有 1 项付费外部 MiniMax 测试跳过）、`pnpm build`。
- 已通过 `pnpm test:e2e`（22 套件 / 294 项，含 polish 36 项及字体/性能/内容审计）、`pnpm cf:build`、本地 `pnpm cf:smoke` + `pnpm test:cloudflare:e2e`（4 项），以及 `pnpm licenses:check`、`pnpm security:policy`、`pnpm i18n:check`；未修改其他需求文档。
