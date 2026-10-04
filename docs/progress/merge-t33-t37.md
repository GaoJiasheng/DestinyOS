# merge-t33-t37 · 五分支前端合并

## 完成项
- 在 main 依次合并环境变量 BRANCHES 中的 wt/t33、wt/t34、wt/t35、wt/t36、wt/t37。
- 每个分支一次双亲 merge commit，未 squash、未 push。
- 合并提交：a682bdd、66bcd86、ee7e824、391bb89、68e8878。
- 保留八字、紫微、周易/奇门、塔罗、占星/吠陀的组件、流程、专业视图及截图基线。
- 共用命盘入口保留七体系分派；报告同时支持八字字段和其他体系章节的点击联动。
- 保留双语文案、全部专项 E2E 脚本、塔罗选牌/逆位参数及占卜时区/种子。
- 表单同时保留紫微无时辰阻断、恢复入口及水合前禁用控件。
- 合并样式、依赖和 lockfile 后实际 pnpm install；lockfile 已一致，无额外漂移。
- 修复测试服务兼容性：恢复 TEST_SERVICE_PORT_OFFSET 及校验，保留各服务独立端口覆盖。
- 生产测试同时兼容 --production / TEST_WEB_MODE，并保留隔离的本地邮件拦截。
- 各分支 docs/progress/T-33.md 至 T-37.md 与原分支逐字节一致。
- Fixture F 文档、birth/F.json、紫微快照已是农历 1993 年闰三月十五 06:00、成都。
- Fixture F 未回退；真实闰月与拒绝 1992 年不存在闰六月的测试均通过，无需改需求文档。
- 未修改或提交 .codex-runs/ 中已有文件与用户改动；保留既有 merge.md 摘要。

## 未完成项
- 本次合并任务无未完成项。
- 上游 T-37 的真实 Three.js 天球仍按原计划由 T-37b 接入，详见保留的 T-37.md。

## DESIGN-GAP 列表
- 合并兼容规则：显式测试服务端口优先于共享端口偏移，各专项 E2E 保留隔离环境。
- 保留单 worker、30s 测试与 60s 内容加载 hook 预算，不改断言或 90% 覆盖率阈值。
- 保留生产测试邮件预加载与原应用生产邮件策略。
- 其余上游 DESIGN-GAP 均保留于 T-33 至 T-37 的进度文档及对应源码。

## 如何验证
- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm content:validate、pnpm build 均通过。
- 实际执行指定链：pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate 2>/dev/null; pnpm build。
- Vitest：45 文件、1156 用例通过；语句/行 99.95%，分支 99.07%，函数 100%。
- 内容校验：3451 条 KU、612 条术语，零 error；保留现有相似文本审阅 warning。
- pnpm i18n:check 通过；pnpm tarot:assets --verify 核验 78 张公版 WebP 通过。
- pnpm test:bazi:e2e：4/4 通过，中英桌面/移动截图与章节/证据联动。
- pnpm exec playwright test --config playwright.ziwei.config.ts：8/8 通过。
- pnpm exec playwright test --config playwright.astrology.config.ts：16/16 通过，中英桌面/移动基线。
- 修复后重新 pnpm lint、pnpm typecheck 通过；git diff --check 通过。
- 五个分支均为 HEAD 祖先，五个 merge commit 均有两个父提交。
