# 合盘 · Synastry（B-01 / B-02）

## 输入与接口

新增 `System.synastry`。统一 `compute({system:'synastry',birth,partnerBirth,now})`，两份输入均为 `NormalizedBirth`，`now` 为调用方提供的 ISO 时刻。纯函数 `computeSynastry(a,b,now)`；输出由 `SynastryChartSchema` 严格校验。报告路由 `/[locale]/synastry/r/[id]`，入口 `/[locale]/synastry`，管理 `/[locale]/me/profiles`。

读取保存档案时只接受归属当前账户的两个不同 `profileId` / `partnerProfileId`，私有出生快照放入加密 `encInput`。匿名双输入沿用设备加密存储。名称、地点、出生日期不进入 URL 或公开分享投影。

## 输出 schema

- `a`, `b`：各含 `bazi`, `ziwei|null`, `astrology`, `vedic` 原生排盘，持久化前沿用 `stripPII`。
- `bazi`：`dayStemRelations` 合／冲；`dayBranchRelations` 六合／六冲等；`yearRelations` 生肖关系；`elementComplementarity`；双向 `favorableSupport`；`complementaryElements`；`tenGodInteractions`；`spouseStars`。
- `ziwei|null`：`comparisons` 命宫与夫妻宫主星；`transformations` 双向生年四化映射到对方同名星所在宫，并标记 `inLifeTriangle` / `inSpouseTriangle`。
- `western`：`aspects` 两盘所有行星有序两两主要相位（包括同名行星），`intimateAspects` 日月金火子集，`overlays` 源盘行星落目标盘宫位。
- `ashtakoot`：`total`, `max:36`, 八条 `kootas[{key,score,max,a,b}]`, `moonLongitudes`, `taraCounts`, `signDistances`, `provisional`。
- `availability`：`ziwei`, `housesA`, `housesB`, `complete`。

## 算法与 DESIGN-GAP 决策

1. 复用既有八字／紫微／回归黄道 Placidus／Lahiri 整宫引擎，不新增排盘依赖。
2. 八字：天干五合与四组冲、地支既有六合／六冲／三合等常量；十神由观察者日主对对方各天干和藏干计算。传统男性看财星、女性看官杀；未指定性别同时列两组，仅作符号比较。
3. 五行差异指数为两组五行百分比的总变差距离 `Σ|a-b|/2`，范围 0–100；越高表示分布越不同，**不是关系成功率**。另列对方喜用五行支持比例，处理浮点上界。
4. 紫微：生年四化按既有全书派标注；同名星在对盘的宫位为落点。命／夫妻宫地支索引偏移 0、4、6、8 属三方四正。不把两人的生年四化当作宫干飞化。
5. 西方：合 8°、冲 8°、三分 7°、四分 7°、六分 5°；任一端日月加 2°，仅加一次。两份出生时刻不能定义行运意义的入相／出相，故不输出 applying。宫位以目标盘尖点为左闭右开区间，处理跨 0°。
6. Ashtakoot 采用北印度基础表，版本 `aifas_2021_base_v1`；方向 A 使用传统男方列、B 使用女方行，与输入性别独立，可交换。不自动应用存在流派争议的抵消／补分规则。
7. 资料：[AIFAS《Horoscope Matching》第三版（2021）](https://www.futuresamachar.com/download/horoscope-matching-325.pdf)，印刷页 111–115 的计分与星宿分类表；代码保存完整 Vashya、14×14 Yoni、7×7 Maitri、3×3 Gana 表，以该版本的方向性单元格为准。
8. Varna 1：按月亮星座分类，A 传统等级不低于 B 得 1。Vashya 2：五类查表；射手／摩羯在 15° 分段。Tara 3：星宿从自身到对方**含起点**计数，两方向各按除 9 余数 3／5／7 得 0，其余得 1.5。Yoni 4：27 星宿映射 14 动物，完整查表。Graha Maitri 5：月亮星座主星完整查表。Gana 6：星宿三类完整查表。Bhakoot 7：月亮星座双向含起点距离含 2／12、5／9、6／8 得 0，否则 7。Nadi 8：星宿同脉 0，异脉 8。各项和须等于 total。
9. 未知时辰：八字无时柱、紫微比较为空；对应占星落宫为空；Guna 根据正午月亮暂定并显示警示。不得推断健康、生育或关系必然结果。
10. 内容共 250 条双语 KU（125 西方相位、20 双向十神、28 紫微主星、24 八项分数档、10 五行、10 合冲关系、33 共同练习）；离线脚本可重建，运行时纯规则。章节键 `overview/communication/love/values_money/conflict/long_term`。专业视图可追溯命中与路径；相似段落由现有解读引擎去重。

## 三组独立手算

顺序均为 Varna / Vashya / Tara / Yoni / Maitri / Gana / Bhakoot / Nadi。

| A / B 恒星月亮经度 | 月亮星宿 | 含起点 Tara | 八项得分 | 总分 |
|---|---|---|---|---|
| 10° / 10° | Ashwini / Ashwini，白羊／白羊 | 1 / 1 | 1,2,3,4,5,6,7,0 | 28 |
| 10° / 20° | Ashwini / Bharani，白羊／白羊 | 2 / 27 | 1,2,3,2,5,6,7,8 | 34 |
| 10° / 190° | Ashwini / Swati，白羊／天秤 | 15 / 14 | 1,1,1.5,0,3,6,7,8 | 27.5 |

第三组：Tara 余数 6／5，一方向 1.5；Yoni 马／水牛为 0；火星／金星 Maitri 为 3；月亮星座距离 7／7 为 7；初脉／末脉为 8。不得把反向星宿计数写成不含起点的 13。

## 多档案与生命周期

`label` 应用层 AES-GCM 加密；`relation=self|partner|family|friend|other`；`isDefault` 默认选择。编辑原档案递增 `version`；旧报告保留独立加密快照并标记版本过期。`isCurrent=false` 只兼容一期归档版本，不再限制每用户一个活动档案。

免费 3／会员 20 个活动档案：用户行锁串行化配额、设默认与删除；部分唯一索引保护唯一默认。当前浏览器 HTTP-only Cookie 只存档案 ID，服务端每次校验归属并回退默认。每日和日历缓存加入档案 ID＋版本。历史按当前档案筛选，并含作为 B 参与的合盘；一期占卜及匿名导入中未关联档案的报告仍在本人历史显示。

删除单档案时删除它参与的报告及分享；其他档案不受影响，默认被删除后选择最早余下档案。迁移将一期历史版本关联报告归并到原活动档案，不改报告快照。账户导出包含全部档案及双档案关联。会员降级不主动删除已有档案，但新增时执行免费配额。

## 验证

引擎单测含上述三组、108×108 月亮 Pada 穷举、Vashya 半宫边界、非法输入／伪造 Schema、无时间／无地点、跨 0°、四化落点与方向；双语报告测试验证六章节、正文篇幅和证据。`pnpm test:synastry:e2e` 覆盖多档案及合盘生成、叠加／并排、分享、归属历史、默认与删除。
