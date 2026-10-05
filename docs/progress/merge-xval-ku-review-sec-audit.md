# 合并 x_validate / ku_review / sec_audit

## 完成项

- 在 main 按给定顺序执行 `git merge --no-ff`，每个分支单独生成 merge commit：
  - `85fefc0`：wt/x_validate，引擎交叉验证、历法与星历修复。
  - `e36d845`：wt/ku_review，双语知识库审稿与触发证据修复。
  - `3757c65`：wt/sec_audit，认证、加密、权限、限流与隐私边界修复。
- 保留各分支的 XVAL.md、KU-REVIEW.md、SECURITY-AUDIT.md 进度文档。
- 唯一冲突为 apps/web/lib/daily-worker-asset.json；重新编译合并后的知识库与浏览器 Worker，生成正确的内容哈希索引。
- 保留 engine 0.1.1、Vitest/coverage-v8 4.1.11 等双方依赖调整；实际执行 pnpm install，合并后的 lockfile 已与依赖一致。
- 核对 04 §9 与 engine/test/fixtures/birth/F.json：均已是农历 1993 年闰三月十五 06:00、成都，无需修改。
- 保留 F 的合法闰月转换、紫微闰月处理及不存在的 1992 闰六月拒绝回归测试。
- 未修改 .codex-runs/，未 push。

## 未完成项

- 本次合并范围无未完成项，无需额外代码修复。
- 各分支既有的生产外部验收与参考来源限制，详见原进度文档。

## DESIGN-GAP 列表

- 本次合并未新增算法、接口或产品设计缺口。
- Worker 冲突处理沿用 scripts/daily-worker-build.ts 的既有内容寻址生成策略与 DESIGN-GAP 注释。
- 引擎、内容、安全分支的既有 DESIGN-GAP 与注释均保留，清单详见各自进度文档。

## 如何验证

- pnpm install：通过，Prisma Client 生成成功。
- pnpm lint、pnpm typecheck：通过。
- pnpm test：63 个文件、3,401 条测试全部通过。
- 覆盖率：statements 99.55%、branches 98.69%、functions 100%、lines 99.82%。
- pnpm content:validate：3,451 KU、615 glossary 通过；既有 66,530 条相似度 warning 为非阻塞项。
- pnpm build：通过，6 个任务成功，Next.js 生产构建完成。
- pnpm licenses:check：941 个包通过许可证白名单，含开发依赖。
- pnpm security:policy、pnpm i18n:check：通过。
- git diff --check：通过；三个 merge commit 均有两个父提交。
