任务名：PERF-WEB-3（线上 Web 卡顿第三轮优化）

先读 docs/progress/PERF-WEB.md、docs/progress/PERF-WEB-2.md、docs/progress/CF-SLIM.md（若存在），了解前两轮做过什么，不要重复也不要回退。

## 线上实测（2026-10-14，用户在新加坡 Singtel，Cloudflare 免费计划把请求分到 LHR/CDG/MXP/WAW 等欧洲机房，单次 RTT≈230ms，且每次可能落到不同机房）

服务端（wrangler tail，main→compute 三 Worker 架构）：
- /zh/daily：compute 冷启动 cpu=2209ms wall=2.9s；热 cpu=371ms；HTML 99KB；用户侧 TTFB 1.3–6s。
- /robots.txt：走 Next 动态渲染，main wall 371–1391ms，compute cpu 14–134ms。应当是纯静态文件。
- /zh、/zh/bazi 公共页：main 的 Cache API 是"每机房"缓存，请求在多个欧洲机房间漂移，几乎总是 MISS（gateMs 66–183ms）。
- 结论：低流量 + 多机房漂移 ⇒ 每个机房的 isolate 与 Cache API 基本都是冷的。任何依赖"同机房热缓存/热 isolate"的优化对真实用户无效。

前端（首页 /zh，Chrome）：
- 43 个 JS 请求，传输 1.07MB，解压 4.1MB；load 6.2s。
- /workers/br/daily-*.js 2053KB（传输 386KB）在首页就被加载——首页不需要它。
- app/global-error-*.js 468KB；chunks/6284d963 486KB；5164e69e 294KB；346a0f25、9540bb42、3758、9122、3601 各 130–170KB。
- 用户反馈：刷新卡、点任何按钮 1–2 秒才有反应。

## 目标（在 Chrome DevTools 节流 RTT 230ms / 下行 10Mbps / 4x CPU 降速 下测量，用 Playwright 或 Lighthouse 脚本化，结果写进 progress 文档）
1. 首页初始 JS 传输 ≤ 300KB（gzip/br 后），解压 ≤ 1MB；首页不得加载 daily worker、three/R3F、粒子等重型模块（改为交互/可见/空闲后按需加载，移动端可降级为静态图）。
2. global-error 必须是极简组件（不引入 i18n 全量 catalog、图形库等），chunk ≤ 20KB。
3. 公共只读页面（首页、各体系落地页、百科/知识页、FAQ、法律页、robots.txt、sitemap、manifest）在构建期预渲染为静态资产，由 Workers Static Assets 直接返回，不经过 Worker 代码；robots.txt/sitemap.xml 为静态文件。HTML 与 RSC payload 都要覆盖，保证客户端导航到这些页也不打 Worker。若某页必须动态（含登录态的头部等），把动态部分拆成客户端小岛或独立小接口，页面主体仍静态。
4. 剩余必须走 Worker 的公共响应，缓存改为全局可用（KV 或 R2，键包含 build 版本），不能只依赖每机房 Cache API；保留 Cache API 作为第一级。
5. compute Worker 冷启动：按路由懒加载重型模块（Prisma/adapter、各体系引擎、知识库、OpenCC 等），用 wrangler 的 startup CPU 测量（或 `wrangler deploy --dry-run` + 本地 workerd 冷启动计时）给出前后对比；目标冷启动 cpu ≤ 400ms。/zh/daily 如果对未登录用户是公共内容，按"日期+locale"预计算后放 KV/静态，热路径 cpu ≤ 50ms；对登录用户的个性化部分，能在客户端用引擎算的就在客户端算（引擎是纯 TS），但引擎 bundle 只在该页按需加载。
6. 交互即时反馈：所有主导航与按钮点击 100ms 内必须有可见反馈。为每个路由段补 loading.tsx 骨架屏；表单/起盘按钮用 useTransition/useFormStatus 显示 pending；主导航 Link 预取（视口内 prefetch），对静态页面使用完整预取。起盘等纯计算尽量在客户端完成，不等服务端往返（服务端仍负责保存/鉴权）。
7. 不得降低视觉质量：首屏美术、主题、动画保留，只改变加载时机；移动端与低端设备可降级。不得改变功能和文案。
8. 增加回归保护：perf 预算脚本（扩展现有 perf:budgets）检查首页初始 JS、禁止首页出现 daily worker / three 等模块、global-error 体积、静态页面不经 Worker（可通过构建产物断言），接入 pnpm test 或 CI 命令。

## 约束
- 遵守 .codex-runs/common.md 的通用约束（完整读一遍）。
- 不部署、不 push。完成后在当前分支提交（Conventional Commits）。
- 必须实际运行 pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build、pnpm cf:build、pnpm perf:budgets（若存在）、pnpm cf:multi:smoke，全部通过。
- 摘要写到 docs/progress/PERF-WEB-3.md（≤ 80 行）：逐项给出前后数字（首页 JS 传输/解压、请求数、节流下 LCP/TTI、点击反馈时间、compute 冷启动 cpu、/zh/daily 热路径）、DESIGN-GAP、未完成项。
