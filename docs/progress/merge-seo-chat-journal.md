# 合并公共内容、聊天评估与日记分支

## 完成项
- 在 main 按顺序合并 wt/seo_content、wt/chat_eval、wt/journal；每个分支单独 merge commit。
- Merge commits：a7c09b2、a9a01e5、ffb4553；未 push。
- 保留公共百科/SEO、聊天安全与评估、加密日记与自我追踪功能。
- 三语言新增文案、CSS、脚本入口均保留双方内容；Worker 索引按合并内容重新生成。
- 合并 package.json 脚本、依赖与 shared 日记 schema 导出；重新 pnpm install 并保留更新后的 lockfile。
- 保留 seo_content.md、CHAT-EVAL.md、B-16.md 及各分支其他既有进度文档。
- 日记 E2E 使用专用服务配置；总 E2E 入口包含 SEO 与日记专项。
- SEO E2E 输出改到隔离目录，避免清理 test-results/chat-eval 归档。
- Fixture F 文档与 birth/F.json 原本均为农历 1993 闰三月十五 06:00 成都，核对后保持。
- 未操作 .codex-runs/；保留启动时已有的修改、删除和未跟踪文件。

## 未完成项
- 无。

## DESIGN-GAP 列表
- SEO 专项复用根 Playwright 的隔离输出目录，保留聊天评估归档；代码已注明。
- 日记专项沿用现有私有功能的独立服务配置，不在默认开发服务器套件执行。

## 如何验证
- 已按指定组合命令执行；pnpm install、pnpm lint、pnpm typecheck、pnpm content:validate 通过。
- pnpm licenses:check：1,147 个包通过白名单；pnpm i18n:check 通过。
- 默认 Playwright --list：16 项，排除需要专用配置的 SEO/日记。
- pnpm test：91 个文件、3,603 项通过，1 个真实 provider smoke 按默认配置跳过。
- 覆盖率：语句 99.58%、分支 98.87%、函数 100%、行 99.85%。
- 内容校验：3,826 个 KU、627 个术语通过；pnpm build：6 项任务成功、2,517 个静态页面。
- pnpm test:seo-content:e2e：10 项通过；pnpm test:journal:e2e：zh/en × 桌面/手机 4 项通过。
- TEST_SERVICE_PORT_OFFSET=100 pnpm test:chat:e2e：既有开发服务配置、provider mock，12 项通过。
- 一次额外聊天生产模式尝试因开发种子 cookie 不适用而中止；使用原配置重跑通过。
- 专项 E2E 后再次 pnpm build 恢复生产产物；git diff --check 与评估归档保留检查通过。
