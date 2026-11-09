# DAILY-V2 每日运势差异化（完成）

## 根因（已确认）

1. 五维同分：`scoring.ts` 五维同一基线 + 同向等幅增量，同日两两星级相同 65.2%。
2. 短评：`daily.rating.{n}` 全站 5 句，维度相同星级相同即同一句。
3. 正文雷同：跑管线后确认 **fallbacks.yaml 不是主因**（四段首段落到兜底仅 9%，多为 love）；
   真正原因是所有 KU 同构：首句“你可以…”+ 括号术语 + 对冲句，再被 `dailyExcerpt` 截成 100 字。

## 改动

- 引擎：评分表拆 `daily/score-rules.ts` + `score-rules-sky.ts`；基线 60、clamp 15–95、星级阈值不变。
  四柱按宫位分流（月柱→事业、日柱→感情、年柱→人际、时柱→健康/财），流日地支主气十神半权，
  喜忌按当日十神聚焦维度，新增金/水/日/火行运与牌组权重；overall 加权后放大 1.5 倍（`OVERALL_SPREAD`）防回归 60。
  引擎输出**只增不改**：`scoreDrivers`（每维最强触发）与 `astro.natalMoon`，都是 optional。
- 文案：`dailyDriver.*`（13 类触发 × 维度 × 方向，note + effect）、`dailySky.*`、`dailyPeriod.*`，
  共用 `packages/ui-core/src/daily-drivers.ts`，web 与 mobile 同一逻辑。旧报告无 `scoreDrivers` 时回退旧文案。
- 兜底与对冲：fallbacks 六维按维度重写并删除对冲句；tarot/panchang 删对冲句；全页只留底部 `report.disclaimer.short`。
- 周/月：`daily-period-section`（首屏）+ 动态 `daily-period-view`；复用 `computeDailyRange`、`getDailyRangeAction`、
  `getCalendarYearAction`、`calendar.worker`（新增 from/to，周不算年度事件）；页面内按“档案 + 日期范围”缓存。
- 裂图：`ArtImage` 懒加载前 `<img>` 无 src 但带 alt，整页截图把 alt 画成文字。未进视口前 alt 置空。
- 版本：引擎 0.3.0→0.4.0，知识库 1.7.1→1.7.2；更新 `packages/engine/test/fixtures/daily/A.json`。

## 差异度（`apps/web/test/daily-diversity.test.ts`，档案 A–E × 2026-10-04 起 30 天）

| 指标 | 改前（A–G） | 改后 | 测试阈值 |
| --- | --- | --- | --- |
| 同日五维两两星级不同 | 34.8% | 60.3% | > 55% |
| 五维星级 1/2/3/4/5（改前 A–G×30 共 1050，改后 A–E×30 共 750） | 25/275/548/200/2 | 18/196/372/150/14 | 五档都有，1+5 星 < 15% |
| 总评星级 1/2/3/4/5 | 2/61/115/32/0 | 6/34/77/32/1 | 至少 4 档 |
| 同维度 30 天不同短评数 | 3 | ≥ 6（按触发+方向） | ≥ 4 |
| 单档案 30 天覆盖星级数 | — | 4–5 档 | ≥ 4 |

正文四段：5 档案 × 每 6 天抽样，zh/en 两两不同且无对冲句；确定性：`computeDailyRange` 重算全量相等。
`computeDailyRange` 30 天约 1.3 秒（机器并发负载下），完整 `computeDaily` 约 10 秒。

## 验证（dev + 本地档案）

`test-results/daily-v2/` 下 today / week / month 的桌面与 375px 截图。
周/月视图首次点击才加载，匿名计算在 calendar worker。

## 未覆盖

- docs/systems/daily.md §3.5 的评分表未改（docs 外不动），现以代码为准，见 score-rules.ts 的 DESIGN-GAP。
