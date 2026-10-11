# PERF-WEB-2 · 线上交互卡顿第二轮优化

## 完成项

- 58 个路由加载边界提供金色呼吸骨架；公共、分享与后台根布局都有顶部导航进度条。
- 链接/按钮按下态 40ms；减少动效时即时高亮。导航视口预取与悬停/触摸/键盘意图预取。
- 表单 useTransition/useFormStatus 行内反馈、同步提交锁；保留文档规定的推演仪式时间。
- HTML/RSC/预取按 locale、部署版本、路由状态头隔离 Cache API；统一 1h s-maxage + 5min SWR。
- 登录、私有路由、Action、范围与重验证请求绕过共享缓存；费用熔断先于缓存。
- 主 Worker 直接读取公共构建 HTML/Flight；动态 Next/Auth/引擎/解读/Prisma 移至 compute。
- media 独立运行 satori/resvg、Browser Rendering 和完整自由文本转换；通过同账户绑定调用。
- 服务端 Sentry 移除；客户端仅配置 DSN 后加载。主/compute 均不含 OpenCC/媒体 SDK。
- zh-TW UI、知识库与编辑内容构建期生成；运行期仅保留发布词汇与模板的小型映射。
- today 通过未缓存 Action 加载账户上下文；learn 移除索引页的整份术语导航，保留独立术语路由。
- 三份 Wrangler 配置、构建与体积预算；CI 主 raw ≤8MB、media ≤8MB、compute ≤24MB，各 gzip ≤8MB。
- perf:ttfb 增加 RSC/Next-Router-Prefetch 采样、缓存命中与载荷门槛；LAUNCH.md 说明子 Worker 先发布。

## 本地 workerd 对比（2026-10-07）

| 指标 | 优化前 | 优化后 |
| --- | ---: | ---: |
| 主 Worker raw / gzip | 26,964,841 / 6,137,947 B | 1,003,051 / 199,815 B |
| /zh 冷首请求（HTML） | 74.3ms | 71.4ms |
| 公共 RSC 热请求/P75 | learn 11.7ms；today 668.0ms（各单次） | 最高 4.4ms（各 10 次） |
| 浏览器公共跳转 P75 | 未采样 | tarot 21.6ms；today 15.5ms；learn 8.1ms；首页 17.1ms |
| /zh/today Flight | 346,367 B | 108,687 B |
| /zh/learn Flight | 267,020 B | 76,604 B |

首请求在 Wrangler ready 后计时；工具启动 4466ms 单独记录，不等同生产 SIN 冷启动。基线仅单次，不能冒充基线 P75。
浏览器测量为热状态、预取后点击到新标题与进度条结束，每路由 10 次；阻塞 Flight 的反馈测试通过 ≤100ms 门槛。

## DESIGN-GAP

- 公共快路径只包含构建生成且白名单允许的页面；完整 Flight 快照仍按路由状态/预取头分键。
- 公共文案/知识产物随部署更新；有账户上下文的页面与运行时配置路径继续进入 compute。
- 选择拆完整动态应用：主路径零 Prisma；无需为公共页面另写 D1 ORM 替代层，私有热路径保留现有 KV/D1。
- 消息按功能边界加载，私有打印入口单独提供完整目录；zh-TW 小型映射覆盖发布内容，任意自由文本由 media 转换。
- 导航取消/同路由无 Next 15 完成事件时有 15s 上限；refresh 通过 transition 完成事件收尾。
- 媒体使用编译 WASM 与无 DOM 的 SVG QR；导出逐文件 NDJSON 帧，8MiB/文件、32MiB/请求内存边界。
- 本地配置移除生产域名；模拟登录/控制端点只在测试入口。Browser 本地不可用时保留 renderer mock + 私有 R2 验证。
- 客户端消息与通知宿主按需加载；意图预取保留日期等查询参数；提交完成且控件启用后恢复原键盘焦点。
- 移动测试固定自身 React 实例；WEB-NOPAY 通过独立数据库/服务配置运行。
- 分享根布局与令牌可用性守卫分层，请求内去重读取；学习 URL 构建清单前置校验，保留 ISR 回退与真实 404。
- 打印等待隐藏流式副本消失；E2E 等待登录/重定向完成并检查可见内容；浏览器跳转按预取后点击到新标题采样。

## 验证与未完成项

- 实际运行并通过 pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build；单测 3692 + mobile 4，原有 2 项环境限定跳过。
- 全部 Node E2E 316 项通过（逐套件执行与失败修复重跑），含 polish 46、真实 PDF/300dpi PNG 导出 5；fonts:check、i18n:check、licenses:check 通过。
- pnpm cf:build 与 pnpm cf:multi:smoke 通过；compute raw/gzip 21,469,923/4,502,372 B，media 6,600,974/2,039,491 B。
- pnpm cf:smoke 联调后，pnpm test:cloudflare:e2e 7/7 与 PERF_TTFB_URL=http://localhost:8787 pnpm perf:ttfb 通过，预取每 10 次有 9 HIT。
- 多 Worker 覆盖真实三语 OG、三种分享模板、OpenCC、加密 D1/KV、私有 R2/本地导出 mock 与费用熔断；采样写 .test-data/perf-{web-2,navigation}.json。
- 未执行部署/push；生产 SIN P75/冷启动、真实 Browser Rendering 配额需 Owner 上线后复测。
