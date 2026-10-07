任务：线上交互卡顿第二轮优化（Owner 反馈：任何按钮点下去都要 1–2 秒才有反应）。
实测结论（2026-10-07，新加坡 SIN 节点）：
- 页面内纯客户端交互（如塔罗牌阵单选）不访问服务器，本身即时。
- 站内跳转走 RSC 请求（?_rsc=），这类请求完全没有边缘缓存；热实例 TTFB 0.2–0.4s，冷实例 1.1–5s；Server-Timing next 冷 1.3–1.8s、热 0.13–0.3s。
- Worker 原始体积约 27MB（gzip 6.2MB），冷启动解析是 1–2s 的主因。metafile 大项：OpenCC 2.08MB、Prisma WASM 1.87MB、resvg WASM 1.38MB（分享图）、Sentry 约 2.26MB（生产未配置 DSN，纯死重量）。
- 跳转期间无任何即时反馈；/zh/today 的 RSC 载荷 345KB、/zh/learn 267KB。
目标：站内跳转与按钮的「可感知反馈」≤ 100ms；公共页站内跳转 P75 ≤ 300ms；主 Worker 原始体积 ≤ 8MB、冷启动后首个请求 ≤ 400ms。
要做（三项都做）：
1. 即时反馈：每个路由段加 loading.tsx 骨架屏（与真实布局一致的金色呼吸骨架，不用转圈）；全局顶部细进度条（导航开始立即出现）；所有按钮/卡片/链接有按下态（active 缩放与高亮，≤ 50ms）；表单提交与 Server Action 用 useTransition/useFormStatus 显示行内加载态并防重复点击；减少动效设置下保持可用。
2. 预取与缓存：导航与体系卡等 next/link 开启预取（视口内预取 + 悬停/触摸开始时预取）；公共路由的 RSC 响应纳入现有部署版本隔离的边缘 Cache API（区分 RSC 与 HTML、区分预取请求头，键包含 locale 与部署版本；登录、私有数据、Action 一律不缓存）；为 RSC 设置与 HTML 一致的 s-maxage/SWR。确认 Next-Router-Prefetch 请求可命中缓存。
3. 拆 Worker 为主应用瘦身（Cloudflare Service Bindings，同一账户，不增加费用）：
   a. 移除服务端 Sentry（保留可选的客户端 Sentry，无 DSN 时不加载）；
   b. 繁体中文（OpenCC）改为构建时预生成 zh-TW 文案与知识库分片，运行时不再加载 OpenCC；用户提交的自由文本若需转换则放到子 Worker；
   c. 分享图/OG（resvg/satori）与 PDF/长图导出（Browser Rendering）拆到独立 Worker `destinyos-media`，主 Worker 通过 Service Binding 调用；
   d. 排盘计算与解读（engine + interpret + 知识库读取）评估拆到 `destinyos-compute` Worker 或保持按路由懒加载，以冷启动实测为准，择优；
   e. 如 Prisma WASM 仍是主 Worker 冷启动大头，评估在只读热路径（公共页、每日运势读取）改用 D1 binding 直接查询。
   每个子 Worker 有独立 wrangler 配置、构建与体积预算，CI 增加主 Worker ≤ 8MB 原始体积门槛；本地 wrangler dev 多 Worker 联调与冒烟通过。
4. 跳转载荷：/zh/today 与 /zh/learn 的 RSC 载荷各降到 ≤ 120KB（把大块静态内容移到客户端按需加载或拆分路由段）。
5. 验收：本地 workerd 测主 Worker 冷启动首请求与站内跳转耗时（前后对比表）；更新 perf:ttfb 脚本增加 RSC 跳转采样；全部单测、E2E、polish、cf:build、多 Worker 冒烟通过；写 docs/progress/PERF-WEB-2.md 与 LAUNCH.md 的多 Worker 部署说明（部署顺序：子 Worker 先、主 Worker 后）。提交，不部署、不 push。
