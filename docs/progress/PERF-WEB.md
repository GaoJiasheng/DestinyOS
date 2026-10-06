# PERF-WEB：生产站点性能排查与修复

日期：2026-10-07。需求依据：00-overview、03-ui-ux 首页、09-architecture、12-platform-cloudflare。未部署、未 push。

## 完成项

- 公共首页、体系落地页、学习/法律页：部署版本隔离的 Cache API，`s-maxage=3600, stale-while-revalidate=300`；显式后台 SWR。登录、RSC、查询参数、Action、私有响应与认证 Cookie 隔离。
- OpenNext 开启增量缓存拦截：可写 R2 + 本次部署公共 HTML/RSC Assets 回退；空 R2 也不必启动 NextServer；仍保留 ISR 与现有 self-reference 后台队列。
- 今日一瞥、公告/维护提示改客户端加载；实时熔断两次 KV 并行，维护拦截仍在共享缓存前。公开语言 Cookie 每次响应单独生成。
- 首页仅序列化 shell 文案，功能路由独立提供完整 next-intl 文案；中英/繁中路由与文案键保留。OpenCC 公告转换留服务端。
- 引擎按计算路由动态导入；知识库按体系/语言 Assets 分片且 isolate Promise 缓存，失败可重试；发布版本缓存最多 24 项，D1 快照只读所需体系。
- Prisma 保留原有请求内懒加载/清理；知识库版本快速路径不再顶层导入 ORM。无 DSN 时不初始化 Sentry；health 原生 D1/KV 并行、成功结果缓存 60 秒、失败不缓存。
- 新增脱敏生命周期日志和 Server-Timing；CI 新增 `pnpm perf:ttfb`，每路由 10 次采样，最近秩 P75（第 8 项），公共/登录 API/health 预算 300/600/150ms。
- 脚本还检查公共 HIT≥8/10、首页 HTML≤120,000B；`PERF_TTFB_URL` 指定站点、`PERF_TTFB_COOKIE` 提供专用测试登录态、`PERF_TTFB_SKIP=true` 跳过；报告不含 Cookie。

## 请求生命周期耗时表

同机本地 workerd 实测；首次请求指已就绪的新进程，清空本地 Cache API/R2；不是生产 isolate startupTime。阶段可重叠，不能直接相加。

| 阶段 | 修复前 | 修复后 | 证据/边界 |
| --- | --- | --- | --- |
| health 首次进入首个 I/O 前 | 414ms | 不加载应用 | 本地 Observability：原请求 443ms，首个 KV span 延后 414ms；框架/Prisma/WASM/Sentry合计，不能逐项归因 |
| health D1 / KV | 6 / 25ms | 6 / 5ms（并行） | 原生 span / 新 Server-Timing；成功 HIT 时均为 0 次 |
| 公共页熔断 | 2 次串行 KV | 2 次并行 KV，约 0–2ms | 保留实时维护优先级，HIT 也执行 |
| 公共首页首次 OpenNext | 经 NextServer | import 16ms + handler 27ms | Server-Timing；仅首次 MISS，HIT 无应用初始化 |
| 公共页 HIT | 原 ISR `s-maxage=2`、STALE | Cache API 直返 | Next/Prisma/D1/知识库/Sentry 均 0 次，仍有 2 次熔断 KV |
| 知识库读取/解析 | 已有体系+语言 isolate 缓存 | 保留并加发布版本内存缓存 | 并非每请求读 Assets；发布指针仍每次 D1 查询；MISS 另有 KV/所需体系 D1 分块，次数依分块数 |
| next-intl | 全文与词条进根 Provider | isolate 文案缓存 + 分路由 Provider | zh 原文案 131,649B + glossary 243,491B；占 HTML 主因，非字体 CSS |
| 引擎/WASM/Sentry 初始化 | 大应用路径可达 | 公共 HIT/health 不初始化 | metafile 为体积证据，不代表运行时耗时；真实生产细分待 tail 权限 |

## 前后数字与验证

- 生产旧版本新加坡各 10 次：首页/塔罗/health P75 = 2121/2161/1787ms；首页 395,975B；未部署新版本，不能据本地数字宣称全球目标已达成。
- 本地各 10 次：health 首次 447→35ms、P75 10.2→3.0ms；首页首次 253→49ms、P75 10.3→3.9ms；塔罗首次 136→7ms、P75 10.0→3.5ms。
- 本地首页 zh 398,352→112,842B（约 -72%），en 117,463B；塔罗 88,888B；首页初始 JS gzip 182,297B，通过 180KiB 预算。空 R2 的中间版本首页首次 866ms，公共 Assets 回退后 49ms。
- 本地登录态预算实测：`/api/auth/session` P75 6.4ms、`/zh/me` 25.8ms；首次完整 Next API（`/api/auth/providers`）约 549ms，后续请求 P75 6.3ms。
- dry-run 原始/gzip：26,656,328 / 6,068,744B → 26,932,442 / 6,182,415B；gzip 仍低于 8,000,000B，延迟加载降低初始化，未减少整包上传体积。
- metafile 大项：OpenCC 2.08MB、Prisma WASM 1.87MB、resvg WASM 1.38MB、Sentry 汇总约 2.26MB；引擎 astronomy/lunar/Temporal 约 153/355/139KB。
- 已实际通过：pnpm install、lint、typecheck、test（3681 passed / 2 skipped，mobile 4 passed）、build、cf:build（含 wrangler deploy --dry-run/metafile）、Cloudflare 浏览器冒烟 6 项；perf:ci（15 次 Lighthouse 性能 86–99 / 无障碍 100，另 4 项浏览器回归）、i18n、许可证、安全策略检查通过。
- 重现：`pnpm cf:build` → `pnpm cf:smoke` → `PERF_TTFB_URL=http://localhost:8787 pnpm perf:ttfb` / `pnpm test:cloudflare:e2e`；用本地 `/cdn-cgi/local/explorer/api/local/observability/query` 的 SQL spans 查询对照 Server-Timing。

## 未完成项与 DESIGN-GAP

- `wrangler tail destinyos --format json` 返回 “No access to specified resource”；生产 Observability/冷启动细分、全球与真实登录态 P75 必须由 Owner 部署后采样验证。
- Smart Placement 未开启：现有本地证据是框架初始化更显著，不能外推生产 D1 往返；Owner 若观察到 D1 主导，按官方文档做启用/关闭 A/B，复测公共与登录 API。
- DESIGN-GAP：部署版本 cache namespace；手工 SWR 3900 秒存储/3600 秒公开 freshness；60 秒 health 成功快照；独立语言 Cookie；脱敏时序日志；熔断并行但不缓存。
- DESIGN-GAP：公开 HTML/RSC 静态 Assets 回退及版本不可变时间；Next 15.5 完整 cache key；现有队列 ISR；功能文案裁剪；公告每分钟客户端刷新及服务端 OpenCC；首页延迟引擎导入。
- DESIGN-GAP：发布知识库 24 项内存缓存/每次查版本指针、失败重试、单体系分块读取；无 DSN 跳过 SDK；curl 首字节定义、CI 可跳过。均在对应源码注释说明，无新增依赖。
- 参考：[OpenNext caching](https://opennext.js.org/cloudflare/caching)、[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)、[Smart Placement](https://developers.cloudflare.com/workers/configuration/placement/)；Cache API 不原生执行 SWR，因此代码显式后台刷新。
