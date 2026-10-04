# 分支合并

## 完成项

- 在 main 按顺序合并 wt/t11、wt/t12_15、wt/t13_14、wt/t16、wt/interp。
- 每个分支各有一个 merge commit；未 push。
- 冲突保留七体系引擎、共享 schema、包导出、双语文案与全部分支进度文件。
- 依赖合并后实际运行 pnpm install，重新生成并保留 lockfile。
- 修复共享类型/schema 与格局检测函数重名，保留各体系原实现。
- 内容流水线分别校验 78 张塔罗牌、8 个牌阵、来源记录、64 卦原文与 KU。
- 新增内容表整合回归测试，未知内容文件仍必须通过 KU 校验。
- docs/04-engine-overview.md §9 与出生 Fixture F 同步为农历 1993 年闰三月十五 06:00，成都。
- 更新 F 规范化快照、紫微完整黄金结果及闰月分半测试；保留 1992 无闰月错误回归。

## 未完成项

- 本次合并任务无未完成项；各分支原有后续任务范围见保留的进度文档。

## DESIGN-GAP 列表

- 根导出重名时保留先合入的 API，另提供 QimenStarKey、DivinationPillarSchema、detectQimenPatterns 别名。
- 数据表与 KU 共用体系目录，按明确文件路径选用独立 schema；双语草稿正文允许空，不编译为 published KU。
- 紫微穷举 150 个命盘的测试独立延长至 30 秒，适应全仓库 V8 覆盖率检查。
- 合入分支已有 DESIGN-GAP 保留，详见其原进度摘要与代码注释。

## 如何验证

- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm content:validate、pnpm build 全部通过。
- 按指定顺序运行 pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate 2>/dev/null; pnpm build。
- Vitest：20 个测试文件、922 条测试通过；语句/行 99.94%，分支 98.97%，函数 100%。
- pnpm i18n:check 通过；中英文键及 ICU 语法一致。
- git diff --check 通过；各目标分支均为 main 祖先，五个合并提交均含两个 parent。
- 最终修复提交：chore: post-merge fixes；.codex-runs/ 原有改动保留且未纳入提交。
