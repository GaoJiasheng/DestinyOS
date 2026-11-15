# NEXT16-UPGRADE · Web 升级到 Next.js 16

日期：2026-11-09；基线：6e3eedb；分支：upgrade/next16。未 push、未部署、未写线上资源。

## 状态：cf:build 与 cf:multi:smoke 通过（2026-11-10）

Owner 选择先瘦身、不放宽预算。瘦身见下方“预算回收”；预算阈值未改动。

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

## 预算回收（2026-11-10，阈值未改）

- Radix Dialog 改为空闲预载、首次打开时挂载（`components/ui/dialog.tsx` 包装 `dialog-impl.tsx`）。
- 移除 tailwind-merge：组件只传语义类名，`cn()` 改为 clsx。
- `@tianji/shared` 标注 `sideEffects: false`，报告/校正页不再带 journal schema 背后的 Temporal polyfill。
- 今日页塔罗 Provider 只下发牌名与正逆位；删除未被引用的 `DailyTarotCard`。

| 指标（gzip 字节） | 升级后 | 回收后 | 预算 |
| --- | ---: | ---: | ---: |
| 首页首屏 JS | 204,418 | 182,894 | 184,320 |
| rectify | 280,660 | 206,849 | 266,240 |
| today/calendar | 279,372 | 249,946 | 266,240 |
| [system]/new | 415,162 | 389,953 | 409,600 |
| r/[id] / r/local/[id] | 379,728 / 380,259 | 322,008 / 322,541 | 358,400 |
| /zh/today Flight | 128,460 | 96,736 | 120,000 |

首页余量约 1.4KB；外壳剩余最大块为 next-intl 的 ICU 格式化（约 11.6KB）。

### ICU 预编译（2026-11-15）
- 未用 next-intl 的 `experimental.messages.precompile`：其加载器会把点号 key 嵌套，与扁平目录 + `toMessages` 冲突。
- 只借它的运行时：浏览器与 SSR 层把 `use-intl/format-message` 换成 `format-only`（`next.config.ts`），RSC 仍用完整解析器。
- 所有客户端 Provider 改走 `ClientMessages`（`i18n/client-provider.tsx`），服务端用 `icu-minify/compile` 预编译并按原文、按子树缓存；子树复用保证 Flight 去重不失效。ESLint 禁止直接引入 `NextIntlClientProvider`。
- `test/precompile.test.ts` 对三语全量目录逐条比对 format-only 与完整解析器输出。

| 指标 | 之前 | 之后 |
| --- | ---: | ---: |
| 首页首屏 JS（gzip） | 183,398 | 174,471 |
| 各路由首屏 JS | — | 均 −8.9KB |
| /zh/today Flight（原始字节） | 96,723 | 97,232 |

## 未完成项
- 线上行为需部署后复测，含 `$`、`!` 路径的段文件在真实 Workers Assets 的表现。
