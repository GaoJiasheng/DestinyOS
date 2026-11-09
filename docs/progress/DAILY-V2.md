# DAILY-V2 每日运势差异化（未完成，受 16:54 截止限制）

## 雷同的根因

1. 五维短评：`today-view.tsx` 用 `daily.rating.{星级}` 取文案，全站只有 5 句，
   键里没有维度也没有触发因素。五个维度只要星级相同就是同一句话。
2. 星级本身缺乏区分度：`packages/engine/src/daily/scoring.ts` 五维都从 60 分起算，
   3 星区间是 55–69；多数规则（favorable / unfavorable / combine / clash / tarot 等）
   对五维给同号且幅度接近的增量，所以没有强触发的日子五维全部落在 3 星。
3. 正文四段雷同：未及排查（推断与 1 同构，按星级/回退规则取段落，见 `packages/content/daily/fallbacks.yaml`）。

## 本次改动（仅第 1 点的文案层）

- `apps/web/messages/{zh,en}.json` 新增 `daily.rating.{career|wealth|love|health|social}.{1..5}` 共 25 句 × 2 语言。
- `today-view.tsx` 五维短评改用按维度的键；总评仍用 `daily.rating.{n}`。
- `apps/web/test/daily-diversity.test.ts`：固定档案 A × 30 天，断言同一天五句互不相同、
  25 句互不相同、每个维度 30 天内至少出现 2 种短评、重复计算一致。

## 兼容性

- 没有改 packages/engine、interpret、shared、content，每日输出结构、缓存键、引擎/内容哈希与快照都未变，mobile 不受影响。

## 未完成

- 评分规则区分度（根因 2）未改：需要在引擎里新增按维度的触发因素字段（向后兼容），再按触发因素选文案。
- 正文四段去重与对冲句合并、周/月视图、今日星象文案、裂图均未做。
- 裂图：本分支 `行动提示` 卡片内没有 `<img>`（只有 ShareDialog 的预览图，alt 为 `share.preview`），
  截图 `test-results/polish/1280/zh/daily.png` 也不在本 worktree，未能复现。
- zh-TW 已由 `scripts/i18n-traditional.ts` 生成（只提交了 `zh-TW.json`；脚本后半段因缺 `packages/content/dist` 中断）。
- 已跑：新测试 6/6 通过、`i18n:check` 通过、改动文件的 eslint 与 prettier 通过。
  未跑：全量 `pnpm lint` / `typecheck` / `test`、mobile 测试、`fonts:check`（新文案可能有字体子集外的字）。
