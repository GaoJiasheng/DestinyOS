# merge · 五分支合并

## 完成项
- 在 main 按顺序合并 wt/c_bazi、wt/c_ziwei、wt/c_iching、wt/c_qimen、wt/t04_06。
- 每个分支独立 merge commit，保留各分支 docs/progress/*.md。
- 保留八字、紫微、周易、奇门双语知识库及各体系测试、覆盖率脚本。
- 合并公共三元字符相似度工具，保留缓存比较器及两套导出接口，统一 Dice 算法。
- 合并确定性文案变体选择：按用户或匿名命盘选取，保留互斥约束和跨语言一致性。
- 合并全部 package.json 脚本和依赖，重新 pnpm install，校验 lockfile 与 Prisma Client。
- 保留认证、字段加密、数据库迁移、限流、健康检查、日志和监控功能。
- 合并后的知识库版本提升至 1.2.0，避免与各分支单独发布版本混淆。
- 核对 04 §9 Fixture F 及 birth/F.json：已为农历 1993 年闰三月十五 06:00、成都，无需修改。
- 修复完整合并语料在覆盖率模式下超过原初始化与周易变体审计时限的问题。
- 未修改 .codex-runs/，未 push。

## 未完成项
- 本次合并任务无；各分支原有人工审阅、外部服务联调限制详见对应进度文档。

## DESIGN-GAP 列表
- 新增：完整双语语料的初始化校验钩子时限 30 秒，保留测试断言与覆盖率门槛。
- 新增：周易跨用户双语变体审计时限 30 秒，包含完整语料校验与多次报告生成。
- 保留：字符三元组采用 Dice 相似度，提供预计算和按调用生命周期缓存。
- 保留：解读 context 可选 userId；匿名变体以命盘 JSON 作确定性种子。
- 各分支其余 DESIGN-GAP 保留于 T-23-bazi、T-23-ziwei、T-23-iching、T-23-qimen、T-04-T-05-T-06 进度文档及源码。

## 如何验证
- pnpm install 通过，Prisma Client 生成成功。
- pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate 2>/dev/null; pnpm build 全部通过。
- 内容校验：1,427 条 KU、444 条术语；相似度仅按 05 §7 输出审阅 warning。
- Vitest：29 文件、1,049 用例全部通过；覆盖率语句/行 99.95%、分支 99.07%、函数 100%。
- 测试含 Fixture F 闰月、全部引擎、真实 Chromium 离线运行、双语内容、认证与加密。
- pnpm i18n:check 通过，zh/en 键与 ICU 语法一致。
- 合并依赖的许可证为 MIT、ISC 或 Apache-2.0；未引入 AGPL/GPL。
