# PERF-WEB-3 · 线上 Web 卡顿第三轮优化

日期：2026-10-15；基线：70cde9f。未部署、未 push，未修改其他需求文档或 .codex-runs/。

## 完成项

- 2475 个三语公共路由构建 HTML + 完整 Flight，放在 canonical HTML / `.rsc` 资产路径；robots.txt、sitemap.xml、manifest.webmanifest 直接走 Static Assets。
- 原有登录态头部保留客户端小岛；合盘也拆为静态主体与所有者上下文。公共内容在熔断期间继续可读，鉴权、提交、计算接口仍熔断。
- 公共 Flight 在路由初始化前映射到资产；公共页 Action 用 `/_actions` 传输，Worker 还原原 URL；保留请求体、鉴权、来源检查、日期查询和构建切换时的 HTML 回退。
- 删除首页 fallback Flight 引入的不可达 M0 占位实现；移除 today worker preload；今日视图、天象计算、专业表格与各体系图表按页面/可见/交互加载。
- Hero 原有银河美术、CSS 星空、主题与动画保留；桌面真实星空在首次交互后空闲加载，移动端使用美术/CSS。
- global-error 仅两条构建提取文案、原生重试按钮；next-intl zh/en/zh-TW 同步；监控仅在配置 DSN 且出现根错误时加载。
- 每日示例预计算 189 份，覆盖三语、七个时区、昨天至未来七天；键含引擎/知识 worker 内容哈希、locale、时区和日期。缺失时客户端计算，资产 404 不初始化 Next。
- 登录每日页一次鉴权取所属档案、原种子身份和当前发布知识；随后在本页 worker 计算；日期切换不等待服务端计算，原服务端缓存接口保留兼容。
- L1 Cache API + 全球 KV L2；部署版本与原有变体隔离，私有响应不进入缓存；保留 SWR、故障回退与实时熔断。
- 既有 58 个 loading 边界、transition/form pending 与按下反馈保留；静态页面完整视口预取，动态页只预取 loading；塔罗直接导入所需 schema/constants。
- perf:budgets 检查实际首页脚本、解压预算、重型模块/preload、错误 chunk、公共预渲染及 HTML/Flight 产物一致性；Cloudflare CI 增加实际节流浏览器检查。

## 前后数字（本机 Chrome / workerd）

Chrome：RTT 230ms、下行 10Mbps、4× CPU，1280×800；包含 load 后十秒内的自动预取/下载。

| 指标 | 基线 | 完成后 |
| --- | ---: | ---: |
| 首页全部自动 JS，gzip / Brotli | 1,332,899 / 1,038,875 B | 242,341 / 207,820 B |
| 首页 JS 解压 | 4,998,284 B | 778,671 B |
| JS 请求 / 全部请求 | 54 / 85 | 31 / 77 |
| 节流 LCP / load | 972 / 1764ms | 968 / 1525ms |
| TTI 静默代理 / 最后长任务结束 | 12860 / 8909ms | 8372 / 827ms |
| 主导航点击到可见反馈 | 55.9ms | 35.1ms |
| global-error 自身 chunk raw | 479,383 B | 1,366 B |
| compute 启动采样活跃 CPU / 采样窗口 | 24.3 / 215.6ms | 23.8 / 197.6ms |
| 本地公共首个 HTML / 最高 Flight P75 | 前轮 71.4 / 4.4ms | 55.1 / 3.3ms |
| 每日公共 HTML、Flight、示例 JSON 的 Worker 调用 | 原需主 Worker；示例客户端重算 | 0；客户端示例也不加载 daily worker |

压缩量由浏览器实际解码响应计算；本地 workerd 不模拟线上 Brotli 传输。TTI 静默代理定义为最后长任务/资源完成 +500ms，非 Lighthouse 的历史 TTI 审计。
compute 使用完整约 21MiB 上传包；`check startup --args='--config wrangler.compute.toml'` 显式传递嵌套打包配置；基线用开始时保存的原 JS/WASM multipart 包。
用户提供的线上 `/zh/daily` CPU 2209/371ms 属冷/热请求；本仓库该 URL 为 404，文档每日路由是 `/zh/today`，两组不同指标未冒充直接同比。

## DESIGN-GAP

- 混合 Next 应用以独立 Flight 文件及 Action 前缀兼容 Assets；响应 URL 保留原页面，私有 compute 强制先执行 Worker；资产内容随构建发布。
- 公共资产绕过费用熔断；示例按有限日期/时区预计算、按内容哈希版本化，缺失回退浏览器；所有者知识经鉴权 Action 获取且保留原种子。
- 可见/交互/空闲加载、移动静态降级、独立常量导出、不可达占位清理、根错误小目录及既有骨架复用。
- KV 第二级沿用 1h freshness +5min SWR，1MiB 正文上限，损坏/故障回退、cookie/private 拒绝与部署隔离。
- 十秒下载观察窗、解码后压缩估算、500ms 静默代理、完整启动包 CPU 采样；相关注释位于对应源码。

## 验证与边界

- 已实际通过 pnpm install、lint、typecheck、test、build、cf:build、perf:budgets、cf:multi:smoke、perf:web:3、licenses:check。
- 单测 3814 passed / 原有 2 skipped；mobile 58 suites / 276 passed。跨机房 KV、私有隔离、故障/SWR、Flight/Action 传输、发布知识 worker 覆盖均验证。
- Cloudflare 浏览器流程 7/7 通过：三语资产、匿名起盘、登录档案与每日本地计算、媒体、熔断恢复和客户端导航。
- 多 Worker 验证公共资产零 Worker 时序头、三语示例 JSON、真实媒体 PNG、移动鉴权/同步、熔断与恢复；浏览器证明每日示例无计算 worker 请求。
- 证据：.test-data/perf-web-3-{before,after,startup}.json、perf-web-2.json、首页截图；复现 pnpm cf:build → pnpm cf:multi:smoke → pnpm perf:web:3。
- 未完成项：真实欧洲/新加坡生产 TTFB、首次动态请求 CPU 与线上压缩传输量需部署后复测；本任务明确不部署，不以本地采样替代生产验收。
- 配置依据：[Workers Assets](https://developers.cloudflare.com/workers/static-assets/binding/)、[startup profiling](https://developers.cloudflare.com/workers/wrangler/commands/workers/)。
