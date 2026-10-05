# merge · PDF / AI 追问 / 生命灵数

## 完成项

- 在 main 按 BRANCHES 顺序使用 --no-ff 合并，每个分支单独生成双亲 merge commit。
- 22c060e：wt/f_pdf；5e0735c：wt/f_chat；778a37f：wt/f_numerology。
- 合并报告导出与聊天入口、后台开关/额度、环境变量、中英文案及全部 E2E 脚本。
- 保留 PDF/PNG、MiniMax 追问、生命灵数引擎/内容/页面与双方测试、数据库迁移。
- 重新 pnpm install，生成 Prisma Client；合并后依赖与 lockfile 已一致，无需额外锁文件变更。
- 逐字节保留 report-export-a4.md、B-05.md、B-10-numerology.md 三份原进度文档。
- 修复新 System.numerology 缺失的聊天白名单映射，补齐六条中英推荐问题。
- 增加生命灵数静态打印 SVG、中英图例，覆盖无姓名报告；导出 E2E 扩展至八体系。
- 新增跨分支回归：生命灵数聊天隐私边界与中英打印渲染。
- 核对 04 §9、birth/F.json、ziwei/F-valid.json：已为 1993 年闰三月十五 06:00、成都，无需改动。
- 本地忽略的 .env.local 将 MiniMax 国际端点改为匹配凭证的国内端点；密钥未修改或提交。
- .codex-runs/ 原有改动和文件保持不变；未 push。

## 未完成项

- 本次合并范围无未完成项。

## DESIGN-GAP 列表

- 新增：生命灵数聊天只投影派生数值，不向供应商发送原始生日字段、生日数字九宫格、带年份周期或目标日期。
- 新增：生命灵数打印采用静态 SVG 数值、九宫格与九年周期环，沿用现有双语键与打印 token。
- 三分支原有 DESIGN-GAP 均保留于源码及各自进度文档。

## 如何验证

- pnpm install：通过，Prisma Client 成功生成。
- pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate 2>/dev/null; pnpm build：全部通过。
- Vitest：70 文件、3460 项全部通过；语句 99.56%、分支 98.73%、函数 100%、行 99.83%。
- 内容校验：3576 KU、622 glossary，通过；既有相似度 warning 保持非阻断。
- pnpm i18n:check：zh/en 键与 ICU 通过；pnpm licenses:check：965 包许可白名单通过。
- pnpm test:numerology:e2e：中英桌面/375px，4 项通过。
- pnpm test:chat:e2e：中英桌面/375px，8 项通过；真实 MiniMax 中英冒烟通过。
- pnpm test:export:e2e：5 项通过，八体系 zh/en 共 16 份暗色 PDF 与逐页 300dpi PNG；浅色预览与菜单、权限、缓存、额度通过。
- 已查看生命灵数中英实际打印图表，标签、数字、九宫格和周期环无裁切或重叠。
- git diff --check 通过；三分支均为 HEAD 祖先，三个 merge commit 各含两个父提交，进度文档内容与源分支一致。
