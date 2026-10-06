# App M03：抽出共享包

## 完成项
- 按 App 方案 §2.3 抽出 `@tianji/ui-core`：占星轮盘及重叠错位、吠陀 D1/D9、紫微宫位、奇门方位、地支关系坐标、五行环、雷达坐标和颜色 token。
- ui-core 运行时代码不依赖 DOM/RN；以仅 ES2022 lib 的 TypeScript 配置验证纯计算边界。
- 新建 `@tianji/api-client`，使用 shared Zod schema 校验输入、成功/失败响应，保留接口字段和路由。
- 支持同源 Web、原生 HTTPS origin、逐请求 token、AbortSignal、Idempotency-Key；平台负责 token 持久化/刷新，不自动重试写请求。
- Web 图表、打印报告、城市搜索与时区查询改为复用共享包；Geo 路由使用同一份 shared schema。
- 新增几何与客户端回归测试、双语 Web 表单测试；保留全部既有截图基线和文案。
- 更新 workspace 依赖、Next 转译配置、许可扫描及生成的 daily Worker 资源元数据。

## 未完成项 / 待验项
- M03 范围内无未完成项。
- Android 原生构建与模拟器验收等待 Owner 安装 Java；本任务未安装 Java。
- 本任务为共享包抽取，不新增 App 界面，故无新增模拟器截图或 Maestro 界面流程。

## DESIGN-GAP
- 延续既有算法：占星采用对称环形松弛，避免选定黄道边界造成偏移。
- 延续既有算法：五行百分比仅在弧长计算时归一化，标签保持原始快照值。
- 延续既有算法：D9 使用精确九次谐波经度。
- 延续既有映射：紫微田宅、交友宫采用最接近的报告主题。
- 新增客户端配置：Web 使用相对 origin，原生注入第一方 HTTPS origin，仅本地开发允许 HTTP。
- 新增测试约定：用测试专属合成 endpoint 验证未来原生 JSON 请求，不新增服务端路由。

## 如何验证
- `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 均实际执行并通过。
- Vitest：128 个文件通过，3697 项通过；保留既有 1 文件 / 2 测试跳过；语句覆盖率 99.54%，分支 98.77%。
- App Jest/RNTL：3 个套件、24 项通过；新增 API 客户端 10 项、几何 9 项和 Web 表单 4 项均通过。
- 全部 Web E2E 套件共 302 项通过，含图表视觉、无障碍、双语八系统 PDF/PNG 导出及三语言业务流程；未更新基线。
- `pnpm test:e2e` 首次在已通过前八组后因首页端口 38100 被其他进程占用而中止；原配置和断言未修改。
- 首页临时隔离到 Web 49177 / 邮件 49178 / 数据库 61403 后通过，随后逐一执行其余原始 E2E 脚本；临时配置已删除。
- 最终 typecheck 在 E2E 结束后串行复跑，避免 Next 生成类型被并发服务清理。
- `pnpm cf:build` 通过；隔离本地 D1 迁移后 Cloudflare Worker 冒烟 5 项通过，未部署。
- `pnpm licenses:check` 通过，检查 1696 个依赖包，未新增 GPL/AGPL 依赖。
- `pnpm --filter @tianji/mobile prebuild:android` 通过，已静态生成 Android 工程；iOS/Android Expo 导出及 App strict 类型检查通过。
