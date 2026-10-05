# 合并辅助定盘、运势日历与繁体中文

## 完成项

- 在 main 依次合并 wt/f_rectify、wt/f_calendar、wt/f_zhtw，各一个 merge commit。
- 合并双方样式、zh/en 文案、引擎导出与 E2E 入口，保留现有其他功能。
- 保留各分支 docs/progress/B-03-rectification.md、B-06.md、B-09.md。
- 合并依赖后实际运行 pnpm install；保留合并后的 pnpm-lock.yaml。
- 重新生成繁体定盘/日历文案、时辰特征及每日运势 Worker。
- 日历服务端接口统一使用共享 Locale 枚举，接受 zh-TW。
- 补充繁体日历接口、缓存隔离与日期跳转单测，以及三语日历/定盘 E2E。
- 核对 §9 与 birth/F.json、ziwei/F-valid.json：已为 1993 年闰三月十五，无需修改。
- 提交留在本地 main，未 push；未操作 .codex-runs/。

## 未完成项

- 无。

## DESIGN-GAP 列表

- 本次合并未新增产品决策；沿用三分支已标注的 DESIGN-GAP。
- 定盘启发式权重、民用时辰代表点、空宫借对宫与加密来源字段：见 B-03。
- 日历五档金色、周一首列、年度事件接口、24 小时缓存与天象边界：见 B-06。
- 繁体术语覆盖、LRU、Prisma 映射、字体子集及整页语言切换：见 B-09。

## 如何验证

- pnpm install
- pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate 2>/dev/null; pnpm build
- pnpm i18n:check；pnpm licenses:check
- pnpm exec playwright test --config playwright.calendar.config.ts
- pnpm exec playwright test --config playwright.rectification.config.ts
- pnpm exec playwright test --config playwright.zhtw.config.ts
- 上述命令全部通过；全仓覆盖率：语句 99.55%、分支 98.87%。
- 日历专项单测 29 项；日历 E2E 12 项、定盘 E2E 6 项、繁体 E2E 2 项通过。
- E2E 覆盖 zh/en/zh-TW 桌面及移动端；许可证检查通过 966 个包。
