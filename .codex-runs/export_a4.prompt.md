你是 DestinyOS（天机）项目的施工工程师。仓库根目录的 docs/ 是唯一需求来源，先读 docs/00-overview.md 全文，再读任务指定的文档节。
通用约束：
- 技术栈与目录结构严格按 docs/09-architecture.md；枚举值、字段名、路由、文案键以文档为准，不得更名。
- 不引入 AGPL/GPL 依赖。TypeScript strict，禁止 any 逃逸。
- 用户可见文案一律经 next-intl，zh 与 en 必须同时提供。
- 文档未覆盖的细节选最主流做法，并在代码中加 `// DESIGN-GAP: <说明>` 注释。
- 不要修改 docs/ 目录（除非任务明确要求）。不要动 .codex-runs/。
- 完成后必须实际运行 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（若有）、`pnpm build`，全部通过才算完成；把失败修到通过。
- 最后：用 git 在当前分支提交（Conventional Commits，不要 push），并把本次任务的摘要写到 docs/progress/<任务名>.md：完成项、未完成项、DESIGN-GAP 列表、如何验证。摘要控制在 60 行内。
- 全程不要询问，自行决策。网络可用，可以安装 npm 包。
任务：长图宽度统一为 A4 宽度（Owner 要求：PDF 是 A4，长图宽度也按 A4，高度随内容延长、不分页）。
在当前分支（已包含 commit b539829 的长图/PDF 实现）上修改：
1. 长图只保留一种宽度：1654px（A4 210mm @ 200dpi），排版边距与字号按 A4 版面比例（左右边距约 12mm 等效），视觉与 PDF 首页一致；删除 1242/1600 两档及其 UI 选项、schema 与缓存键中的宽度分支（缓存键保留格式版本号，确保旧缓存失效）。
2. 超过高度上限（16000px）时不分页、不加宽，改为对整个版面做等比缩放（最小正文字号不低于 PDF 的 9pt 等效像素），仍超限则降低 JPEG 质量至不低于 70；二维码保持可扫。
3. 更新单测、Fixture A 七体系 zh/en 长图验收（存 test-results/export/）、docs/03 与 docs/progress/EXPORT-ONEPAGE.md。全部检查通过后提交，不部署、不 push。
