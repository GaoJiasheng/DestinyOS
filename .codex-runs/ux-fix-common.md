# UX 修复施工 · 公共约定（所有施工包必读）

项目：/Users/gavin/work/DestinyOS，web 在 apps/web（Next 16 App Router + next-intl 4，Cloudflare Workers）。
问题清单与证据：docs/progress/UX-AUDIT-2026-11-15.md（先读你负责的条目；「未抽查」的条目先读证据行确认问题真实存在，不存在就在汇报里说明并跳过）。

## 并行施工规则（重要）
- 同时有其他代理在同一个工作目录里改别的区域。**只改你施工包「文件范围」里的文件**。确实需要改范围外的文件时，不要改，在汇报里写明需要什么。
- 共享文件只许「追加自己的内容」，不许重排、不许格式化整文件、不许动别人的行：
  - `apps/web/messages/zh.json`、`apps/web/messages/en.json`：新增文案 key（两个文件都要加，key 一致，ICU 参数一致）。**不要**手改 `zh-TW*.json`，也**不要**运行 `pnpm i18n:traditional` 或 `content:build`，繁体由主代理统一生成。
  - `apps/web/app/globals.css`：新增/修改你区域的样式规则。改已有规则前确认它只被你的组件使用。
  - Edit 报「文件已变化」时重新 Read 再改，不要用 shell 整文件覆盖共享文件。
- **禁止**：任何 git 写操作（commit/stash/checkout/reset/add）、部署、`next build`、启动 dev server、安装/升级依赖、改 perf 预算阈值、改 eslint/tsconfig 配置。
- 不要顺手重构，不要改清单以外的行为。

## 代码约定
- 文案全部走 next-intl（客户端 `useCopy()` / 服务端 `getCopy()`，见 apps/web/i18n/use-copy.ts、get-copy.ts），不要在组件里写死中文或英文。语气见 docs/12-i18n-and-copy.md 第 2 节（中文温和笃定、全角标点；英文 plain-spoken、sentence case）。
- 传消息给客户端只能用 `ClientMessages`（apps/web/i18n/client-provider.tsx），不要直接用 `NextIntlClientProvider`（lint 会报错）。新增的客户端文案如果在外壳命名空间之外，确认对应 Provider 的消息子集里包含它（i18n/client-messages.ts、i18n/feature-messages.ts）。
- 偏离设计文档的实现在代码处加一行 `// DESIGN-GAP: 原因` 注释（仓库惯例）。其余注释只写「为什么」，英文。
- lint 规则：单文件 ≤400 行、禁止 `any`、`react-hooks/exhaustive-deps` 为 error、apps/web/lib 下禁止 `console`。
- 可访问性：新增控件要有可读标签、键盘可达；动效尊重减弱动效设置。
- 手机端优先：主按钮点击区高度 ≥44px。

## 自测（只跑与你相关的）
- 在仓库根目录：`npx vitest run apps/web/test/<相关测试>`；为你改的逻辑补/改单元测试（apps/web/test/）。
- `npx eslint <你改的文件>`，`npx prettier --write <你改的文件>`（不要对共享的 json/css 跑 prettier --write 以外的格式化工具；这两个文件跑 prettier 可以）。
- `cd apps/web && npx tsc --noEmit -p .`：只关心你范围内文件的报错；别人文件的报错忽略并在汇报里提一句。
- 你改了文案或选择器时，grep `apps/web/e2e` 里引用到的旧文案/选择器并同步更新 spec（不用跑 e2e）。

## 汇报格式（中文，800 字以内）
1. 逐条：条目编号 → 已修 / 跳过（原因）/ 部分（剩什么），一句话说明做法。
2. 改动文件列表。
3. 新增的文案 key 列表。
4. 需要主代理或其他包配合的事项。
5. 自测结果（跑了什么、结果如何；没跑的要说明）。
