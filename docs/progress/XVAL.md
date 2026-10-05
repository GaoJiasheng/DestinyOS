# XVAL · 引擎独立交叉验证

## 完成项
- 独立 Python venv 在 /tmp；sxtwl 2.0.6、pyswisseph 2.10.3.2、kinqimen 0.0.6.6、ephem 4.2.1、iztro-py 0.5.0。
- Python 参考工具仅在 engine/test/xval；无 npm/运行时新增依赖，无 GPL/AGPL 代码或二进制进入发布产物。
- 固定种子生成 300 个随机合法出生档案、60 个起卦/起局时刻，JSON 位于 engine/test/fixtures/xval。
- 年份 1900–2030；12 城市、南北半球、东西经；65 个 DST、19 个真太阳时跨日、30 个无时辰档案。
- 另有 192 个节气前后样本（1900/1988/2000/2030 × 24 × 2）、324 个 Nakshatra/Pada 边界样本。
- 核验公农历往返、四柱两种子时流派、前后节/起运、行星、ASC/MC、宫头、Lahiri、月宿、Dasha 比例、紫微主星与命身宫。
- 奇门三元针对 5/10/15 日的 22:59/23:00 换界；核验九宫地盘、天盘、九星、八门、八神与梅花时间数。
- 修复八字真太阳时误移年/月柱节气边界、起运节气距离及大运月柱；采用真实 UTC 时刻。
- 修复历法将固定 UTC+8 星历时刻误套上海历史 DST 的问题。
- 修复高纬 ASC 相反交点（原误差 180°）、平均莉莉丝缺少倾角投影（原最大误差 0.120513°）。
- 更新相关八字黄金用例；content/test 的七份纯引擎输出快照同步莉莉丝与相位数值，未改内容源代码或前端。
- 引擎版本 0.1.1；CI 仅消费 JSON，无 Python 依赖，另验新增测试 strict TS。

## 差异裁定与流派
- 八字：sxtwl 按节气日 0 点换年/月，适配为其精确节气 JD；23:00 换日/分子时分别核验，schoolUsed.ziHour 回显。
- 奇门：kinqimen 符头三元与文档 §3.2 节气后日数三元不同；60 局中 34 局原始三元/局数不同；保留完整 raw 与仅指定文档局数的独立 pan(1)，不声称原始一致。
- 按文档默认拆补规则执行，不新增符头流派开关；schoolUsed.yuanBasis=solar_term_elapsed_days。
- 勾陈/朱雀命名对应文档白虎/玄武，schoolUsed.deityNames=bai_hu_xuan_wu；中五仍按 centerLodge 回显。
- kinqimen 1906-02-03/2009-07-27 的时干落中宫分支有 16 个错误天盘干；独立星/地盘一致，以文档“随星携干”不变量验证；严格锁定异常名单。
- 高纬 Placidus 按文档改 Whole Sign，schoolUsed.houseSystem 与 W_HOUSE_SYSTEM_FALLBACK 同时断言。
- 修复后行星/节点/Lilith 最大误差 0.009800°；ASC 0.000111°、MC 0.000063°、宫头 0.000094°；均远小于文档容差。
- 紫微使用纯 Python iztro-py，非 JS 调用；其算法和历法祖先与 iztro 有关联，不能视作独立历史流派证据。

## 未完成项／限制
- Chiron：Swiss Moshier 后端无凯龙星历，保留原近似标记，本次未独立核验；其余西方行星/节点/Lilith 已核验。
- 紫微 `now` 取出生后 30 年，落在库的十二大限支持范围；未扩展原有超范围错误行为。
- 本次对照不宣称参考站点人工核验，也不扩展塔罗/每日运势独立参考来源。

## DESIGN-GAP 列表
- 真太阳时影响日/时柱，节气年/月与起运差值使用物理出生时刻；起运日期使用民用日期。
- 极圈 ASC 选东侧黄道/地平交点；莉莉丝采用平均 5.145° 倾角投影，未复制 Swiss 源码。
- 奇门专业元数据增加三元依据与八神命名；参考库天盘缺陷由独立不变量验证。
- 太阳钟参考容差 0.1 分钟、Lahiri 1′；Dasha 采用既有 365.25 日年，月亮误差按 0.1° 传播。
- 集成测试的引擎输出快照位于 content/test；同步工具仅重建七份快照。
- kinqimen 的旧 ephem 4.1.3 无法在当前 macOS 编译，本地替换为已实测的 4.2.1；requirements 用 --no-deps 固定全部工具。

## 如何验证
- 复现步骤、固定依赖与来源链接：packages/engine/test/xval/README.md。
- pnpm exec vitest run packages/engine/test/xval.test.ts：2110 项通过。
- pnpm exec tsx packages/engine/test/xval/audit.ts：输出覆盖分布、最大角误差、奇门原始差异统计。
- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build 全部退出 0；58 文件、3323 测试全部通过，语句覆盖率 99.94%、分支 99.01%。
