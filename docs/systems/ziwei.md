# 体系规范 · 紫微斗数

> 代码标识 `ziwei`。主题：东方。**必须**有出生时辰。性别影响大限顺逆与部分星曜解读。

## 1. 用户视角的功能

1. 输入出生信息 → 十二宫命盘（命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母），每宫的主星、辅星、煞星、杂曜、四化、宫干、大限区间、小限。
2. 命宫身宫、五行局、命主身主。
3. 生年四化、当前大限四化、流年四化三层叠加显示。
4. 报告 8 章（§6）。
5. 专业视图：传统方格盘（4×4 外圈 12 格、中宫放基本信息）。

## 2. 输入与选项

```ts
type ZiweiOptions = {
  school: {
    leapMonth: 'split_by_15' | 'as_next' | 'as_prev';   // 默认 split_by_15
    useApparentSolarTime: boolean;                      // 默认 true
    siHuaTable: 'zhongzhou';                            // 全书/中州派四化表，一期唯一
  };
  now: ZonedDateTime;                                   // 当前大限/流年
};
```

## 3. 排盘算法（引擎封装成熟库，施工时以库 API 为准；下面是用于核验与理解的标准步骤）

实现方案：**直接使用开源库 `iztro`（候选，见 appendix 选型）**，输入农历年月日 + 时辰索引 + 性别，获得十二宫、星曜、四化、大限、流年数据，再映射为本项目的 `ZiweiChart`。引擎对库输出做完整性校验（14 主星都出现一次、每宫大限区间连续等），失败则抛 `E_ENGINE_INTERNAL`。

标准步骤（供核验）：
1. 真太阳时修正 → 农历年月日 + 时辰（子=0 … 亥=11）。
2. **安命宫**：从寅宫起正月，顺数到生月；再从该宫起子时，逆数到生时 → 命宫。**安身宫**：同样从生月宫起子时，顺数到生时。
3. **十二宫**：从命宫起逆布兄弟、夫妻、子女、财帛、疾厄、迁移、交友（仆役）、官禄（事业）、田宅、福德、父母。
4. **宫干**：五虎遁以生年干起寅宫。
5. **五行局**：由命宫干支纳音定局（水二、木三、金四、土五、火六）。
6. **安紫微**：按五行局与生日查紫微星表；天府与紫微对称（寅申轴）。紫微系：紫微、天机（逆一）、太阳（逆三）、武曲（逆四）、天同（逆五）、廉贞（逆八）。天府系：天府、太阴（顺一）、贪狼、巨门、天相、天梁、七杀（顺六）、破军（顺十）。
7. **辅星**：左辅右弼（按生月）、文昌文曲（按生时）、天魁天钺（按年干）、禄存（年干）、天马（年支）；**煞星**：擎羊陀罗（禄存前后）、火星铃星（年支 + 生时）、地空地劫（生时）；**杂曜**（一期列入）：天刑、天姚、红鸾、天喜、孤辰、寡宿、天哭、天虚、龙池、凤阁、台辅、封诰、三台、八座、恩光、天贵、天官、天福、天才、天寿、截空、旬空、天伤、天使、阴煞、解神、天巫、天月、蜚廉、破碎、华盖、咸池、月德、天德、大耗、龄星辅弼等，以库支持为准。
8. **长生十二神、博士十二神、岁前十二神、将前十二神**（库支持则纳入专业视图）。
9. **四化**：按年干查表（甲：廉破武阳；乙：机梁紫阴；丙：同机昌廉；丁：阴同机巨；戊：贪阴右机；己：武贪梁曲；庚：阳武阴同；辛：巨阳曲昌；壬：梁紫左武；癸：破巨阴贪），分别为化禄、化权、化科、化忌。大限四化用大限宫干，流年四化用流年干。
10. **大限**：起于命宫，阳男阴女顺行、阴男阳女逆行，起始岁数 = 五行局数（水二局 2–11 岁……），每宫 10 年。
11. **小限**：按年支起宫（寅午戌起辰……），男顺女逆，一年一宫。
12. **流年**：当年地支所在宫即流年命宫，其余宫随之布。

## 4. 星曜亮度与庙旺

每颗主星在十二宫位的庙、旺、得、利、平、不、陷用标准表（库自带 `brightness`）。解读引擎用 `brightness` 调整 KU 权重：庙旺 ×1.2、得利 ×1.0、平 ×0.8、不陷 ×0.6，并选用对应的"陷地文案变体"。

## 5. 输出 Chart Schema

```ts
type ZiweiChart = {
  basics: {
    lunar: { year: number; month: number; isLeap: boolean; day: number; hourBranch: Branch };
    yearStem: Stem; yearBranch: Branch;
    fiveElementsClass: { name: 'water_2'|'wood_3'|'metal_4'|'earth_5'|'fire_6'; number: number };
    soulMaster: StarKey;  bodyMaster: StarKey;      // 命主、身主
    soulPalaceBranch: Branch; bodyPalaceBranch: Branch;
    zodiac: Branch;                                  // 生肖
  };
  palaces: Array<{
    index: number;                      // 0 = 命宫，逆时针
    key: PalaceKey;                     // 'life'|'siblings'|'spouse'|'children'|'wealth'|'health'|'travel'|'friends'|'career'|'property'|'wellbeing'|'parents'
    branch: Branch; stem: Stem;
    isBodyPalace: boolean;
    majorStars: Array<{ key: StarKey; brightness: Brightness; mutagen?: Mutagen }>;   // mutagen 生年四化
    minorStars: Array<{ key: StarKey; brightness?: Brightness; mutagen?: Mutagen }>;
    adjectiveStars: StarKey[];          // 杂曜
    changsheng12: string; boshi12: string; jiangqian12: string; suiqian12: string;
    decadal: { fromAge: number; toAge: number; fromYear: number; toYear: number };
    ages: number[];                     // 小限年龄列表
  }>;
  horoscope: {
    decadal: { palaceIndex: number; stem: Stem; mutagens: Record<Mutagen, StarKey>; fromAge: number; toAge: number };
    yearly:  { year: number; palaceIndex: number; stem: Stem; branch: Branch; mutagens: Record<Mutagen, StarKey> };
    monthly?: {...};
  };
  patterns: PatternHit[];              // 格局命中（§7）
  emptyPalaces: PalaceKey[];           // 无主星宫位（借对宫）
};
type Mutagen = 'lu'|'quan'|'ke'|'ji';   // 化禄、化权、化科、化忌
```

`StarKey` 为拼音 snake：`zi_wei, tian_ji, tai_yang, wu_qu, tian_tong, lian_zhen, tian_fu, tai_yin, tan_lang, ju_men, tian_xiang, tian_liang, qi_sha, po_jun, zuo_fu, you_bi, wen_chang, wen_qu, tian_kui, tian_yue, lu_cun, tian_ma, qing_yang, tuo_luo, huo_xing, ling_xing, di_kong, di_jie, ...`。显示名由 glossary 映射。

## 6. 报告章节

| # | key | 标题 zh / en | 要点 | 触发维度 |
|---|---|---|---|---|
| 0 | `overview` | 命盘概览 / Overview | 命宫主星组合一句话人设；五行局；身宫所在宫位的含义；三个关键词；五维评分 | life.majorStars, bodyPalace |
| 1 | `life_palace` | 命宫与性格 / Life Palace & Personality | 命宫主星逐颗解释（含庙陷）；星曜组合（如紫府同宫、机月同梁）；辅星煞星修饰；无主星借对宫说明 | life.* |
| 2 | `body_fortune` | 身宫与福德 / Body Palace & Inner Life | 身宫落宫的人生侧重；福德宫主星 → 精神世界、兴趣、压力来源 | body, wellbeing |
| 3 | `career_wealth` | 事业与财帛 / Career & Wealth | 官禄宫与财帛宫主星；三方四正（命财官迁）的整体格局；工作方式与财务风格 | career, wealth, travel |
| 4 | `love_family` | 夫妻与家庭 / Love & Family | 夫妻宫主星与煞忌；红鸾天喜；子女宫、父母宫、兄弟宫简述 | spouse, children, parents, siblings |
| 5 | `health_travel` | 疾厄与迁移 / Health & Movement | 疾厄宫星曜对应的注意面（通俗、非医疗）；迁移宫 → 外出发展、异地 | health, travel |
| 6 | `patterns` | 格局 / Notable Configurations | 命中格局逐条（紫府朝垣、府相朝垣、机月同梁、杀破狼、日月并明、禄马交驰、火贪铃贪、羊陀夹忌、空劫夹命等 ~25 个），每条解释 + 对现实的意义 | patterns |
| 7 | `decadal_yearly` | 大限与流年 / Decades & This Year | 当前大限宫位与大限四化；本年流年宫位与四化叠加；未来 3 年概述；大限时间轴 | horoscope |
| 8 | `summary_actions` | 总结与行动 / Summary | 五条建议 + 免责声明 | all |

## 7. 格局检测（一期 25 个）

实现为纯函数 `detectPatterns(chart): PatternHit[]`，每条含 `key, palaces, stars, strength`。清单与判定（以命宫及三方四正为主）：

紫府同宫、紫府朝垣、府相朝垣、君臣庆会、紫微七杀（化杀为权）、机月同梁、杀破狼、日月并明、日月反背、明珠出海、巨日同宫、石中隐玉、阳梁昌禄、文桂文华、禄马交驰、双禄朝垣、火贪格、铃贪格、火铃夹命、羊陀夹忌、空劫夹命、命无正曜、禄逢两杀、七杀朝斗、极居卯酉。

每个格局的判定条件在代码常量里写清楚（宫位 + 星曜集合 + 可选的四化条件），文档 appendix/glossary.md 收录各格局一句话解释。

## 8. 命盘可视化

- **传统方格盘**：外圈 12 格按地支固定位置（寅在左下角起逆时针……实际：巳午未申在上一行从左到右，辰、酉在第二行两端，卯、戌第三行两端，寅丑子亥在底行从左到右），中宫 2×2 显示基本信息。移动端：中宫缩小，每格最少显示主星 + 四化标记，点击格放大。
- **星曜颜色**：主星金色大字、辅星月白、煞星朱红、杂曜灰、四化用小角标：禄 绿、权 紫、科 蓝、忌 红。
- **三方四正高亮**：点任一宫，其三方四正宫位高亮并连线。
- **大限条**：每宫底部显示大限区间，当前大限宫位有金色呼吸边框。
- **流年叠加开关**：切换显示流年宫位标记与流年四化。

## 9. 核验与测试

参考：iztro 文档站示例（https://iztro.com ）与 ziwei.pub 排盘。

| Fixture | 期望（施工时用参考站核对后填入 fixture） |
|---|---|
| A 1990-05-15 08:30 北京 男 | 农历庚午年四月廿一辰时；核对命宫地支、五行局、紫微所在宫、生年四化（庚：太阳禄、武曲权、太阴科、天同忌） |
| B 1985-11-02 23:40 上海 女 | 真太阳时后仍为子时但日期换到次日（库接受"晚子时"参数或由引擎预先换日）；核对命宫 |
| F 农历 1992 闰六月十五 06:00 成都 | 闰月 split_by_15：十五属上半 → 按六月排；对比 `as_next` 结果不同 |
| E 无时辰 | 抛 `E_REQUIRES_BIRTH_TIME` |

单元测试：安命宫 12×12 查表、安身宫、五行局 60 组、紫微星表（五行局 × 30 日）、四化 10 干表、大限起始岁 5 局 × 顺逆、格局检测每格局 1 正例 1 反例、库输出完整性校验。

## 10. 知识库维度

`ziwei.palaces[key].majorStars[].key`（含组合）、`brightness`、`mutagen`、`palaces[key].minorStars`（文昌文曲、左辅右弼、魁钺、禄存天马、六煞）、`patterns[].key`、`basics.fiveElementsClass`、`basics.bodyPalaceBranch` → 所在宫 key、`horoscope.decadal.palaceIndex` 对应宫、`horoscope.decadal.mutagens`、`horoscope.yearly.*`。

预计 KU：14 主星 × 12 宫（命宫全写 14×4 变体 = 56；其他 11 宫按主星写 14×11 = 154，陷地变体复用字段）、主星双星组合 ~30、辅煞星入关键宫 ~40、格局 25、大限宫位 12、大限四化落宫 ~24、流年四化 ~24、无主星宫 12 → 约 **380 条**。
