# merge · 无障碍性能与代码质量分支合并

## 完成项

- 在 main 按顺序合并 wt/a11y_perf、wt/simplify，每个分支一个双亲 merge commit。
- 合并提交：716288e（a11y_perf）、8f3e1a8（simplify）；未 push。
- 保留新增页面无障碍、懒加载、日历 Worker、字体补全与性能预算。
- 保留模块拆分、目录调整、公共工具及原测试断言，合盘表单同时保留懒加载与新组件路径。
- Worker 资源清单冲突按合并后源码重新生成；保留 url、traditionalUrl、calendarUrl 三个字段。
- 保留 docs/progress/a11y_perf.md 与 docs/progress/代码质量收敛.md 原文。
- 实际 pnpm install 成功；依赖未新增，重新核对后 lockfile 无变化。
- 核对 docs/04-engine-overview.md §9、birth/F.json 和紫微 F-valid.json：已是农历 1993 年闰三月十五 06:00、成都，无需修改。
- 未修改或提交 .codex-runs/ 中既有文件与改动。

## 未完成项

- 本次合并无未完成项；1 个既有实网测试沿用默认跳过。

## DESIGN-GAP 列表

- 本次未新增设计缺口；沿用源码与两个分支进度文档中的既有 DESIGN-GAP。
- 生成资源哈希随合并后的源码更新，不新增路由、枚举、文案键或计算规则。

## 如何验证

- pnpm install 已通过，Prisma Client 正常生成。
- pnpm lint 已通过（内容校验、ESLint 零警告、Prettier）。
- 实际执行 pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate 2>/dev/null; pnpm build，各阶段全部通过。
- Vitest：113 个文件、3611 例通过、1 例既有跳过；行 99.85%、语句 99.58%、分支 98.87%、函数 100%。
- 内容校验：3826 条 KU、627 条术语；保留既有相似正文 warning，无校验 error。
- 生产构建：6 个任务成功，Next.js 生成 2517 个页面，合并后的 Worker 清单稳定无额外变更。
- 两个源分支均为 HEAD 祖先；各自 51 份 progress 文件与源分支逐字节一致。
- git diff --check 与摘要 Prettier 检查通过；无新增依赖，无需额外 post-merge 源码修复。
