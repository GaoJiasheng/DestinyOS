# MERGE-PERF2 · deploy 合并三 Worker 与导航优化

日期：2026-10-07；合并父提交：8ef63a7、d240c07；不部署、不 push。

## 完成项

- merge commit 30c16c8 合入 wt/perf2，保留全部三 Worker、公共缓存、导航反馈、预取及按功能加载文案改造。
- deploy 的新导出面板、单张 1654px A4 宽 JPEG、紧凑双栏可搜索 PDF 保留。
- 渲染实现移入 destinyos-media，Browser Rendering 绑定仍只在 media；compute 保留鉴权、私有 R2 与下载入口。
- 保留 onepage-a4-v2 缓存版本、24h TTL、所有权检查、60s 超时、E_EXPORT_TIMEOUT / E_EXPORT_SIZE。
- 保留单次截图、JPEG 82 与 70 质量下限、16000px 高度与 9pt 字号下限、图片 6MB / PDF 2MB 上限。
- media 只返回一个私有文件，拒绝旧 PNG 分页数组；NDJSON 保留真实进度和错误码。
- 超时取消 service fetch / 响应流；media 抑制断连后的帧，浏览器仍按原截止时间清理。
- 隔离共享 ApiError 类，避免 media 因错误映射载入引擎；更新合并后的繁体词汇与浏览器 Worker 文件索引。
- 逐张核验并更新 26 张图表基线（24 张移动端、2 张桌面端），补全旧基线未加载的装饰图；未放宽 0.5% 截图容差。
- 紫微、占星与无障碍截图等待可见装饰图片解码，不改变生产懒加载。
- 导出几何和文件验收复用生产渲染器的单副本/ready 联合检查，避免 Next 流式副本造成 strict locator 失败。
- chat E2E 默认使用独立端口偏移 250，同步服务与夹具配置；保留环境覆盖，避免其他工作区占用 auth 的 3100 端口。
- 日记截图限定可见已加载页面，避免隐藏流式副本触发 strict locator；加密、导出、删除生命周期 4/4 通过。
- 补齐 media 实际渲染入口、格式布局、单文件协议、错误码、超时取消及 Cloudflare 分流回归测试。

## 未完成项

- 完整 E2E 总入口复跑仍在进行；Cloudflare 构建与联调已全部通过。

## DESIGN-GAP 列表

- 私有 media NDJSON 显式传回导出错误码；传输保留 8MiB 帧上限，具体格式由渲染器执行更严格预算。
- compute 的 60s 截止时间覆盖服务传输；media 的原 60s 渲染截止时间负责浏览器清理。
- 调用方断连后禁止 media 写入已取消的流；不改变已授权打印凭证或缓存逻辑。
- API 错误类与引擎错误映射分离，保持 instanceof 身份与所有既有 API 响应。
- 字体就绪不足以代表延迟装饰已加载；截图额外等待图片解码，不改变生产懒加载。
- 初始打印壳层只有一个未就绪副本；测试必须联合检查副本数量与 ready，避免后续流式插入造成竞争。
- chat 测试默认服务范围与 auth 分离；服务、邮件和 SQLite 夹具共同使用可覆盖的偏移量。
- 日记截图针对用户可见的已加载页面，仍保留加密、所有权、导出与账户删除断言。
- perf2 其他既有 DESIGN-GAP 见 PERF-WEB-2.md；A4 导出既有决策见 EXPORT-ONEPAGE.md。

## 如何验证

- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build 已实际通过。
- 单测 3708 通过、2 个既有环境限定跳过；移动端 4 通过；覆盖率门槛通过。
- 新导出与 media 回归 22 项通过；pnpm i18n:check、pnpm licenses:check 通过（1670 包）。
- 完整导出 E2E 7/7、polish 46/46 通过；16 份中英文系统组合验证 32 个真实文件。
- 单张 JPEG 均宽 1654px、最高 16000px；最大 JPEG 5182570B、PDF 702879B，PDF 均可搜索。
- pnpm db:migrate 本地检查通过；无待应用迁移。
- pnpm cf:build 通过；main / compute / media 原始体积为 1003837 / 21478486 / 6593727B，均在预算内。
- pnpm cf:multi:smoke 通过；冷请求 62.0ms、公开 RSC 最高 P75 4.7ms，简繁分享图经 MEDIA 渲染。
- pnpm test:cloudflare:e2e 7/7 通过，含加密 D1、KV/R2、熔断、缓存隔离和导航 P75。
- Cloudflare 在本地 workerd 验证；远程 Browser Rendering 未调用，本地渲染替身与真实 Chromium 文件验收互补。
- 本地日志在 /tmp/destiny-merge-*.log，产物在 test-results/ 与 .test-data/；无部署、无 push。
