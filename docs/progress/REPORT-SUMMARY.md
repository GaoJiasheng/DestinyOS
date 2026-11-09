# REPORT-SUMMARY — 报告摘要与折叠、重复话术治理

**分支** `worktree-agent-a6e25c7e8f1854f11`（基于 main `fc7f4c8`）

## 改动

1. **去重复话术（组装层）**：新增 `packages/interpret/src/compact-prose.ts`，`interpret()` 按阅读顺序处理每段 KU 正文。
   - 8 条 zh / 7 条 en「使用说明型」常驻提醒、3 个 zh 句尾子句（如「用现实反馈判断这个角度是否贴合你」）全部删除，统一由摘要下方「如何使用这份报告」说明一次。
   - 其余逐字重复句保留首次出现，后续删除；依赖上句（它/这/This/It…）的句子不拆开；分号句收尾、英文句首大写；负面 KU 若失去原本的缓冲语则保留原文；段落全部重复时整段跳过，其衔接句也不输出。
   - 全报告删除后低于 docs/05 §7 字数下限时，退回「按章节去重」；`daily` 不做处理；zh-TW 经 `localizeReport` 跟随 zh。
   - 选择组装层而非批量改 YAML：`packages/content` 校验要求每条 KU 自带行动建议/缓冲语，且其他 worktree 并发编辑内容；每次新增的重复也自动生效。内容源文件未改，`knowledgeVersion` 不变，历史报告不受影响。
   - 来源（语料统计）：bazi「你可以先从一次具体经历…/传统标记只能提供提问…」22 条；ziwei「时间层次改变观察范围…」144 条；iching「若现实信息不同…」64 条；qimen 40 条；en：synastry 250、astrology 225、ziwei 154/144、bazi 20+ 条。单份 bazi 报告（zh，4 盘）重复句由约 100 条降到约 3 条，正文字数 11–13k → 8–9k。synastry en 因模板高度重复，部分盘回退按章节去重。
2. **依据标签**：布尔谓词证据改为展示规则名（比肩较多、官杀并见、七杀…），`interpret()` 不再产出成立/Present；旧报告靠渲染侧过滤兜底（保留）。`print-report` 同名不重复。`daily` 证据不变。
3. **首屏**：`ReportSummary` 上移为 `report-columns` 直接子项；≥1024 栅格 `chart summary / chart notices / chart headline / chart body`，八字/塔罗左栏 480px；vedic、synastry 维持全宽图表行（窄栏会让图表控件低于 44px）。提示条移到摘要下（`report-notices.tsx`）。未新增依赖，图表仍只渲染一次。
4. **折叠与聚焦**：`openSection` 移入 `focus-evidence.ts`；从命盘选中主题直接展开；`hashchange` 展开；`beforeprint` 展开、`afterprint` 恢复。依据点击先在主图表找节点，找不到时展开所在折叠主题内的 chart_ref 并聚焦。
5. **修复上轮遗留**：`report.summary.*` 与既有 `report.summary` 键冲突导致 next-intl 报错，改名 `report.brief.*`（zh/en/zh-TW 同步）。
6. **e2e**：bazi-charts、readings、polish 先展开再定位折叠内容。新增单测 `compact-prose.test.ts`、`focus-evidence.test.ts`。

## 验证（均为实跑）

- 匿名真实生成：八字、未知时辰八字、紫微、周易、塔罗，1280 与 375：首屏摘要、默认折叠、链接跳转展开、Ctrl+P（print 媒体+`beforeprint`）全部展开并恢复；截图 `test-results/report-summary/`（1280 下命盘与摘要同屏）。
- 八字默认页面高度 @1280：约 20255px → 5919px。375 下摘要先于命盘，命盘在摘要之后（首屏容纳不下，属已知限制）。
- 报告正文抽查 bazi/ziwei/qimen/tarot/iching 无半截句（脚本扫描句尾 + 人工抽读）。
- `pnpm content:validate` 通过（3826 KU）；packages/interpret + content 单测 201/202，1 条是 60s 硬编码超时（重跑通过）。
- apps/mobile：`fixture-reference.json` 字数按新组装重建（期望变化），engine.test、m05-ui 通过。
- PDF/长图：export.spec 生产构建实跑 zh/en 八体系通过；打印链路读 `report.sections`，不受折叠影响，导出内容随去重同步减少属预期。
- `pnpm typecheck`：web/packages 通过，mobile 仅 `session-gate.tsx`、`m08/m14` 的 3 处既有错误（未改动文件）。`pnpm i18n:check`、`fonts:check` 通过。perf:budgets 通过（r/[id] 357818 / 358400 gzip，余量小）。
- e2e（生产构建）：readings 8/8；bazi-charts desktop 通过（desktop 基线因图表栏变窄更新）；polish「seven Fixture A」375 通过，1280 除 `term-*` axe `aria-hidden-focus`（modal Popover）外全部通过；bazi-charts mobile 2 张字形抗锯齿差异约 1%（未改基线）。

## 版本与基线

- `interpretVersion` 1.2.1 → 1.3.0；`hash.ts` 未变（只用于选取变体）；`daily-worker-asset.json` 与 `traditional-*-generated.json` 随构建更新。
- 需合并后更新基线：polish-new-pages 与 m5-accessibility 中报告页整页快照（布局/内容变化，未在此轮生成）。

## 未验证 / 推断

- `aria-hidden-focus` 仅 1280 出现、与本次改动无直接关联（未在改动前基线上复现）。
