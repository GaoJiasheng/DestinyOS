# NEXT16-UPGRADE · Web 升级到 Next.js 16

日期：2026-11-09；基线：6e3eedb；分支：upgrade/next16。未 push、未部署、未写线上资源。

## 状态：代码可运行，但 cf:build 未通过

`pnpm cf:build` 的前几步全部通过，只在最后的 `perf:budgets` 退出 1。预算阈值未改动，需 Owner 决定（见“阻塞项”）。`cf:deploy` 串联 cf:build，当前会在部署前中止。

## 版本变化

| 包 | 前 | 后 |
| --- | --- | --- |
| next | 15.5.27 | 16.4.5 |
| next-intl（web） | 3.26.5 | 4.14.9（3.x peer 不含 Next 16） |
| @opennextjs/cloudflare / aws | 1.20.8 / 4.1.7 | 1.20.16 / 4.1.15 |
| wrangler | 4.147.0 | 4.148.0 |
| react / next-auth / @sentry/nextjs | 19.3.0 / beta.32 / 11.4.0 | 不变（peer 已支持 Next 16） |

apps/mobile 的依赖与 lockfile 解析版本未变。

## 破坏性变更与处理

- Turbopack 默认：自定义 webpack 会使构建失败，`build`/`dev` 显式 `--webpack`，打包配置未重写。
- middleware → proxy：仅弃用。proxy 固定 Node runtime，OpenNext 标注为实验性，故保留 edge `middleware.ts`，行为不变。
- OpenNext 1.20.16 新增资产配置检查：要求运行 Next 的 Worker 使用 `html_handling = "none"`。OpenNext 实际运行在 compute，故构建改读 `wrangler.compute.toml` 并为其加该配置；主入口 `drop-trailing-slash` 不变。副作用：compute 的 asset resolver 现对全部路径生效（原先只对主入口数组内路径）。
- 段级预取（默认开启且无开关）：见下节。
- `app-build-manifest.json` 被移除：next.config 增加只写文件的 webpack 插件，按原格式产出，perf-budgets 口径不变。
- next-intl 4：`createTranslator` 按 messages 类型收窄键，`toMessages` 改返回 `RuntimeMessages`；vitest 内联 next-intl（与 next-auth 同法）。所有 Provider 均显式传 `messages`，未把全量文案塞进客户端。
- next-env.d.ts 由 Next 生成且改用 import，加入 .prettierignore（eslint 已忽略）。
- 已核对不涉及：同步 request API（typecheck 通过）、revalidateTag、并行路由、next/image quality 与带查询串的本地图、scroll-behavior、next lint、generateSitemaps。

## 静态发布链路

- 2475 条公开路由复制 7431 个段文件到路由旁的平铺路径（如 `/zh._tree.segment.rsc`）。不保留原嵌套目录，否则目录由 454 增至 15244。
- `static-flight.ts` 按 `Next-Router-Segment-Prefetch` 映射到段文件，整页请求仍走 `.rsc`；`_headers` 给段文件加 `X-Nextjs-Postponed: 2`（Next 据此认定段响应）。
- 资产总数 9709 → 17140。本地 wrangler 的逐文件 watcher 超过约 1 万 fd 后 macOS 上 spawn 报 EBADF，三个本地脚本改用轮询（仅影响本地）。
- 实测（本地 workerd + Chromium）：/zh、/zh/bazi、/zh/today、/zh/tarot、/en、/zh-TW/learn 直开均 `static-assets` 且无 Worker 时序头；首页预取 21 个资产请求全 200；仅动态页（/zh/auth/login、/zh/bazi/new 等）走 Worker；客户端导航 document 请求为 0、未整页跳转；console 无 error。
- Server action：登录后 /zh/today 5 个 `/_actions` 请求全 200；伪造 Origin 返回 500；需登录的 action 匿名返回 null、带会话返回用户数据。
- Google（302 到 accounts.google.com）与邮箱（302 到 verify-request）登录链路在本地 mock 下正常。

## 体积（perf-web-3，前值为 2026-10-15 记录）

| 指标 | 前 | 后 |
| --- | ---: | ---: |
| 首页 JS gzip / Brotli | 242,341 / 207,820 | 269,828 / 229,783 |
| 首页 JS 解压 | 778,671 | 858,321 |
| JS 请求 / 全部请求 | 31 / 77 | 29 / 83 |
| 节流 LCP / TTI 静默代理 | 968 / 8372ms | 856 / 7528ms |
| 导航反馈 | 35.1ms | 57.5ms |
| Worker raw（main/compute/media） | - | 1.08 / 22.32 / 6.87MB，均在预算内 |

增量来自框架：Next 路由运行时 gzip +21.3KB、react-dom +9.7KB；应用代码约 -7KB。

## 阻塞项（阈值未改）
1. `perf:budgets`：首页 204,418 > 184,320（180KB），另有 rectify、calendar、[system]/new、r/[id]、r/local/[id] 超限。升级前首页已是 179,539，余量仅 4.8KB。
2. `cf:multi:smoke`：`/zh/today` Flight 128,460 > 120,000。该路由新增 daily* 文案约 9.5KB（来自 10-14 之后的提交），Next 16 下 /zh、/zh/learn 的 Flight 基本持平，推断非升级导致。临时副本跳过此断言后其余 smoke 全部通过。

## 未完成项
- 上述两项需决定：调预算，或另开任务削减首屏 JS / 今日页文案。
- 线上行为需部署后复测，含 `$`、`!` 路径的段文件在真实 Workers Assets 的表现。
