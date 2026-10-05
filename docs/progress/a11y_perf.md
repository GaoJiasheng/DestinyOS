# 新功能无障碍与性能复审

## 完成项

- 扩展 `test:polish`：zh/en/zh-TW、375/1280 视口，覆盖导出、追问大师、生命灵数、辅助定盘、运势日历、多档案、合盘及学习长文。
- 对正常页、错误状态、弹窗、编辑器、合盘双图和追问记录运行完整页面 axe，144 份报告 serious/critical 为 0；实际 Tab/Shift+Tab/Enter/Space 验证关键流程。
- 修复档案编辑器打开/取消及追问发送后的焦点恢复、对话记录滚动区可聚焦；验证弹窗焦点约束和 Escape 返回、图表定位及日历键盘导航。
- 修复日历中间分数段文字对比度，移动端日期点击区域至少 44px；匿名月历与全年事件移到可取消的本地 Worker。
- 出生信息编辑器、合盘与生命灵数图表按需加载；新增页面和懒加载 chunk 纳入 gzip 体积预算。
- 从实际繁体报告与长文生成字库语料，追加两套字体缺少的 195 个字；真实 WOFF2 cmap 覆盖 2334 个所需字符。
- CI 安装已有 `font-requirements.txt` 的锁定依赖，使 WOFF2 缺字审计能在干净环境中执行。
- 修复长文重复访问时的 ISR 缓存回退；保留未知文章 404。
- Lighthouse 扩展为移动端首页、今日、八字报告、合盘报告、日历，使用真实加密匿名快照和每页三次采样。
- 重建 144 张新增页面截图基线，并检查布局、字体预算、页面错误及缺失文案。

## 未完成项

- 无。

## DESIGN-GAP

- 文档未定义新增页面逐页 JS 上限：档案/聊天/长文 220KB，定盘/合盘输入/日历 260KB，共享报告 350KB，通用出生输入 400KB；懒加载模块 220KB gzip、日历 Worker 250KB Brotli（实际 222KB）。
- 匿名日历离线计算放入 Worker，导航时取消并销毁；异常仅返回 E_INTERNAL，不传输出生信息。
- 编辑器和异步追问补充焦点恢复；移动日历适度减少卡片横向留白以满足 44px 目标。
- 字体审计采用实际转换后的内容语料；仅追加缺字分片，保留原有不可变 URL 与每页 350KB 字体预算。
- 截图固定日期、时区、用户/档案身份与匿名标签，以稳定每日抽取；隔离数据库和聊天模拟覆盖真实持久化，模拟回复遵守 zh-TW；组合生产测试的邮件/支付/聊天拦截。
- 已安装 Next 的长文缓存缺失允许按需 ISR；编译内容查询仍拒绝未知 slug。
- 按 docs/12 的首现术语格式，仅豁免八个规范卦名的中文/拼音/释义，继续检查其他文案残留。

## 如何验证

- `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过；单测 91 文件、3606 通过、1 个既有跳过项，行覆盖率 99.85%。
- `pnpm fonts:check`、`pnpm perf:budgets`、`pnpm licenses:check` 全部通过；许可证检查涵盖 1136 个 npm 包。
- 基线：`pnpm exec playwright test --config playwright.polish.config.ts --grep 'new public pages|new owner pages' --workers=4 --update-snapshots=all`，12 项通过；`pnpm test:polish --workers=4` 完整复验 36 项全部通过。
- 繁体聊天模拟回复修正后，以同配置 `--grep 'zh-TW: new owner'` 重建并再次不更新基线复验，2 项全部通过。
- `pnpm test:calendar:e2e` 12 项通过、`pnpm test:seo-content:e2e` 10 项通过。
- `pnpm exec tsx scripts/perf-run.ts`：最终构建每页三次移动 Lighthouse，最低 Performance 为首页 95 / 今日 88 / 八字报告 91 / 合盘报告 92 / 日历 96；Accessibility 全部 100。
- axe/截图产物位于 `test-results/polish-runner`，Lighthouse JSON/HTML 位于 `.lighthouseci`。
