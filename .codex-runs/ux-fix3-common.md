# UX 修复施工第三轮 · 公共约定（所有施工包必读）

项目：/Users/gavin/work/DestinyOS。web 在 apps/web（Next 16 App Router + next-intl 4，Cloudflare Workers + D1）；App 在 apps/mobile（Expo / React Native）；共用包在 packages/。
问题清单与证据：
- 登录后流程：docs/progress/UX-AUDIT-ACCOUNT-2026-11-15.md
- Expo App：docs/progress/UX-AUDIT-MOBILE-2026-11-15.md
- 上午已修的网页匿名流程（可参考做法和可复用的文案 key）：docs/progress/UX-AUDIT-2026-11-15.md 的「修复记录」
- 两轮修复后的回归记录：docs/progress/UX-AUDIT-ACCOUNT-2026-11-15.md 的「端到端回归」一节。
本轮是收尾：各包的具体要求写在各自的任务说明里，上面的清单只作背景。
先读你负责的条目和证据行；证据与现状不符、问题不存在时，在汇报里说明并跳过。标「推断」的条目先确认再修。

## 并行施工规则（重要）
- 同时有 5 个其他代理在同一个工作目录里改别的区域。**只改你施工包「文件范围」里的文件**（以及你新建的文件）。确实需要改范围外的文件时不要改，在汇报里写明需要什么。
- 共享文件只许「追加自己的内容」，不许重排、不许格式化整文件、不许动别人的行：
  - `apps/web/messages/zh.json`、`apps/web/messages/en.json`：新增文案 key（两个文件都要加，key 一致，ICU 参数一致）。App 的文案也在这两个文件里，App 新 key 用 `mobile.` 前缀。**不要**手改 `zh-TW*.json`，**不要**运行 `pnpm i18n:traditional` 或 `content:build`，繁体由主代理统一生成。
  - 一个 key 不能同时是叶子又是别的 key 的前缀（例如已有 `me.tz` 就不能再加 `me.tz.auto`），否则界面会显示原始 key。
  - `apps/web/app/globals.css`：只新增你区域的样式规则。
  - Edit 报「文件已变化」时重新 Read 再改，不要用 shell 整文件覆盖共享文件。
- **禁止**：任何 git 写操作（commit/stash/checkout/reset/add）、部署、`next build`、启动 dev server / Metro / 模拟器 / e2e（测试端口被占用）、安装或升级依赖、数据库 schema 迁移（需要迁移才能修的条目跳过并在汇报里说明）、改 perf 预算阈值、改 eslint/tsconfig 配置。
- 不要顺手重构，不要改任务说明以外的行为。安全相关的行为（鉴权、限流、账户合并）不要放宽；年龄限制只按「年龄规则」一节改（仅限负责该项的包）。
- `useSubmitTransition().run` 有同步锁：不要在 `run()` 的任务里再调 `afterConsent(() => run(...))`，校验放在锁外。

## 代码约定
- 文案全部走 i18n，不在组件里写死中文或英文。web：客户端 `useCopy()` / 服务端 `getCopy()`；App：沿用所在文件现有的取文案方式。语气见 docs/12-i18n-and-copy.md 第 2 节（中文温和笃定、全角标点；英文 plain-spoken、sentence case）。
- web 传消息给客户端只能用 `ClientMessages`（apps/web/i18n/client-provider.tsx）。新增的客户端文案如果在外壳命名空间之外，确认对应 Provider 的消息子集包含它（i18n/client-messages.ts、i18n/feature-messages.ts）。
- web 里用户操作后才挂载的 `next/dynamic` 组件必须带 `loading`（可用 `@/components/ui/chunk-loading` 的 `ChunkLoading`），否则会触发整页骨架屏并丢状态。
- 偏离设计文档的实现在代码处加一行 `// DESIGN-GAP: 原因`（仓库惯例）。其余注释只写「为什么」，英文。
- lint：单文件 ≤400 行、禁止 `any`、`react-hooks/exhaustive-deps` 为 error、apps/web/lib 下禁止 `console`。
- 可访问性：新增控件要有可读标签；触控区高度 ≥44。

## 自测（只跑与你相关的）
- web：仓库根目录 `npx vitest run apps/web/test/<相关测试>`，为你改的逻辑补/改单元测试；`npx eslint <你改的文件>`；`npx prettier --write <你改的文件>`；`cd apps/web && npx tsc --noEmit -p .`（只关心你范围内文件的报错）。改了文案或选择器时，grep `apps/web/e2e` 同步更新 spec（不用跑）。
- App：`cd apps/mobile && npx jest <相关测试文件>`，为你改的逻辑补/改测试；`npx tsc --noEmit`（只关心你范围内文件的报错）；`npx eslint <你改的文件>`；`npx prettier --write <你改的文件>`。改了 testID 或文案时，grep `apps/mobile/maestro` 同步更新流程文件。
- 别人文件的报错忽略，在汇报里提一句。

## 汇报格式（中文，800 字以内）
1. 逐条：条目编号 → 已修 / 跳过（原因）/ 部分（剩什么），一句话说明做法。
2. 改动文件列表。
3. 新增的文案 key 列表。
4. 需要主代理或其他包配合的事项。
5. 自测结果（跑了什么、结果如何；没跑的要说明）。

## 年龄规则（owner 已确认，仅「年龄」两个包实施，其他包不要动）
- 限制对象是「使用服务的人本人」：用户说是自己的生日（表单选「我自己」、关系为 self 的档案、匿名设备上的本人档案）且未满 13 岁 → 维持现状：拒绝并锁定。
- 用户明确说是「别人」的生日（表单选「别人」、关系不是 self 的档案、合盘对象）且未满 13 岁 → 允许排盘和保存，不锁定。
- 服务端默认按「本人」处理：请求里没有明确标出是别人时，一律按本人校验（旧客户端、缺字段的旧数据都仍然被拒）。
- 13 岁的计算方式（`isUnderThirteen`）不改。首访免责声明里「年满 18 岁」的自我声明属于法律文本，不改；只把锁定页等描述实际行为的文案改准确（阈值 13 岁、作用范围如实）。
