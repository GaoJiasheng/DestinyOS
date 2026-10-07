# EXPORT-ONEPAGE · A4 长图宽度统一

日期：2026-10-07；基于 b539829；范围：导出排版、缓存、单测与验收；不部署、不 push。

## 完成项

- 长图固定 1654px（A4 210mm @ 200dpi），高度随全文延长，仍为单张 JPEG。
- 删除 1242/1600px UI、文案键、请求 schema 字段、打印路由参数与缓存宽度分支。
- 格式版本升级为 onepage-a4-v2，两个旧宽度的缓存均失效；所有权与快照校验保留。
- A4 逻辑版面、12mm 等效左右边距；中文正文约 26.4px / 1.45，英文约 25px / 1.25。
- 封面与命盘并排，复用 PDF 首页布局和标题字体；英文简介显式加载相同压缩字体。
- 正文连续单栏；超过 16000px 仅等比缩放整版，不加宽、不重排、不分页或裁切。
- 最小正文为 9pt @ 200dpi（25px）；尾部二维码保持实际 180px、12px 白边。
- JPEG 初始质量 82，超体积同一截图按 80/76/72/70 再编码，最低 70。
- Node 与 Cloudflare 渲染适配器使用相同尺寸与高度处理；不新增依赖。
- 更新 docs/03 §9、单测；验收拆分为 Fixture A、导出面板、安全边界与缩放用例。
- Fixture A 七体系 zh/en + 生命灵数共 16 张长图、16 份 PDF；二维码全部解码，已检查长图首尾及 PDF 全页预览。

## 未完成项

- 本次功能与验收均完成；16 张长图中 8 张超过旧 3MB 压缩目标，按下方 DESIGN-GAP 采用 6MB 硬上限。

## DESIGN-GAP 列表

- 等比缩小的版面居中于固定 1654px 画布，逻辑宽度与折行保持不变。
- 二维码独立保持输出像素与白边，缩放后重新测量其占高。
- JPEG 质量只能减少字节，不能减少像素高度；达到 9pt 仍超高时返回 E_EXPORT_SIZE。
- A4/200dpi 在质量 70 下的长篇正文超过旧 3MB 目标；保留 3MB 压缩目标、改为 6MB 硬上限，优先满足全文、字号与质量；超硬上限失败。
- 长图采用书籍式紧凑行距与 PDF 同行辅助信息；英文沿用 PDF 原生 62.5% 字宽轴，测量前显式加载字体。
- 沿用 format=png 对应 JPEG、私有 HMAC、24h 缓存与已有分享链接二维码策略。

## 如何验证

- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build 均通过；构建 8/8 成功。
- pnpm test：3692 通过、2 个既有跳过；移动端 4 通过，覆盖率门槛通过。
- pnpm test:export:e2e：7 通过（7.9m）；检查全文、尺寸、字号、边距、二维码及 PDF 页数/字体/搜索。
- 16 张长图均为 1654px，最大高度 16000px、最小正文 25.0069px、最大 JPEG 5,182,570 字节；最大 PDF 702,879 字节。
- 额外真实浏览器缩放：16400px → ≤16000px，断言原折行、9pt 下限、二维码在 JPEG 70 可解码。
- pnpm exec playwright test --config playwright.polish.config.ts --grep 'new owner pages' --update-snapshots：6 通过；zh/en/zh-TW × 375/1280，12 张面板/错误态基线更新，含键盘和 axe。
- pnpm i18n:check、pnpm licenses:check 均通过（1647 个依赖）；未引入新依赖。
- test-results/export/：JPEG、PDF、全页 PNG、首尾预览、每体系 checks.json 与 acceptance-summary.json；本地验收证据不提交。
