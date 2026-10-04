# 体系规范 · 占星（西方本命盘 + 吠陀占星）

> 代码标识：西方 `astrology`，吠陀 `vedic`。主题：西方（吠陀使用西方主题的暖色变体，见 03）。两者共用 `engine/astrology` 的星历、宫位、相位模块，只在黄道基准、行星集、宫位制与解读体系上分叉。

## 1. 用户视角的功能

### 西方 `astrology`
1. 本命盘：行星（日月水金火木土天海冥）+ 北交点 + 凯龙 + 莉莉丝；四轴（ASC、MC、DSC、IC）；12 宫（Placidus 默认）；相位表；元素/模式/半球统计；守护星与互容。
2. 报告 9 章（§7）。
3. 今日行运摘要（供 daily）。
4. 无出生时间：正午盘，无宫位与四轴。

### 吠陀 `vedic`
1. Rashi (D1) 与 Navamsa (D9) 盘，北印度（菱形）与南印度（方格）两种画法可切换，默认南印度。
2. 行星（日月水金火木土 + Rahu/Ketu），恒星黄道（Lahiri），Whole Sign 宫位，月亮 Nakshatra 与 Pada，Lagna（上升）及其 Nakshatra。
3. Vimshottari Dasha：Mahadasha（大运）与 Antardasha（次运）时间表，当前所处与未来 20 年。
4. 行星状态：自宫（own）、旺（exalted）、落（debilitated）、友敌（简表）、逆行、焦伤（combust）。
5. 简化 Yoga（一期 12 个）：Gajakesari、Budha-Aditya、Chandra-Mangala、Pancha Mahapurusha（5 个）、Raja Yoga（简化判定）、Dhana Yoga（简化）、Kemadruma、Neecha Bhanga（简化）。
6. 今日 Panchang（Tithi、Nakshatra、Yoga、Karana、Vara）供 daily。
7. 报告 8 章（§8）。

## 2. 星历引擎

**选型（定稿）**：`astronomy-engine` 2.1.19（MIT，精度 ±1′，<120KB，浏览器可跑）。不使用 Swiss Ephemeris：其 AGPL 条款要求整站开源且授权决定必须在公开服务上线前作出，商业授权价格不公开（见 04 §10 与 appendix/research-libraries.md）。宫位、Lahiri、Nakshatra、Dasha、Panchang 在其之上自研，并以 astro.com / Jagannatha Hora 的结果做黄金用例校验。

需要的能力：
- 给定 UT 时刻（儒略日），输出各天体的**地心黄道经度、纬度、速度**（视位置，含光行差），精度 ≤ 1 弧分即可满足占星需求。
- 月亮平均/真交点（北交点 = Rahu）；凯龙若库不支持则用轨道根数近似（一期可标注"近似"）或以 JPL 简化表插值。莉莉丝（平均远地点）用解析公式。
- 恒星时（GMST → LST）、黄赤交角（含章动）、ASC/MC 计算。
- 宫位：Placidus（迭代法）、Whole Sign、Equal、Koch（一期前三个必做）。
- Lahiri ayanamsa：`ayanamsa(JD)`，使用 Lahiri（Chitrapaksha）标准公式；输出到 debug 便于与其他网站比对（如 2000-01-01 ≈ 23°51′）。
- 日出日落（Panchang 的 Vara 与 Tithi 从日出起算）。

接口：

```ts
computePositions(jdUT: number, bodies: Body[], opts: { topocentric?: false }): Record<Body, { lon: number; lat: number; speed: number; retrograde: boolean }>
computeAngles(jdUT, lat, lng): { asc: number; mc: number; ramc: number; obliquity: number }
computeHouses(system, asc, mc, lat, obliquity): number[]   // 12 个宫头黄经
ayanamsaLahiri(jdUT): number
aspects(positions, orbs): Aspect[]
```

## 3. 西方占星排盘

1. UT → JD；若 `timeUnknown` → 当地 12:00，`noonChart = true`。
2. 行星位置 → 星座（`floor(lon/30)`）、度分秒、逆行标记。
3. 四轴与宫位（非 noonChart）：每颗行星所在宫（按宫头区间）；行星是否在宫头 ±3° 内标注"临宫头"。
4. 相位（主要：合 0、六分 60、四分 90、三分 120、冲 180；次要：半六分 30、半四分 45、八分之三 135、十二分之五 150，一期次要相位仅专业视图显示）。容许度表见 04 §4；输出 `applying/separating`。
5. 统计：元素（火土风水）、模式（基本/固定/变动）、阳性/阴性、半球（上下/左右）、象限、星群（stellium ≥ 3 行星同宫/同星座）。
6. 守护：各宫守护星（现代守护：天王星守水瓶、海王星守双鱼、冥王星守天蝎；专业视图可切传统守护）；命主星（ASC 守护）；互容。
7. 月相（出生时）。
8. 特殊：行星在 29° 之后标"Anaretic"；日月与 ASC 的"出生前的新月/满月"不做。

## 4. 吠陀排盘

1. 同样的行星位置（仅日月水金火木土 + 平均节点），减去 Lahiri ayanamsa → 恒星黄经。
2. Lagna = 恒星化的 ASC；Whole Sign：Lagna 所在星座为第 1 宫。
3. Nakshatra：`floor(sidLon / 13.3333)`（0 = Ashwini），Pada = `floor((sidLon mod 13.3333) / 3.3333) + 1`。
4. Navamsa（D9）：每星座 9 等分 3°20′；D9 星座 = 按火/土/风/水三方起始规则（火象从白羊、土象从摩羯、风象从天秤、水象从巨蟹）顺数。
5. 行星状态：Dignity 表（旺/落/自宫/Moolatrikona）；Combustion 距日阈值（月 12°、火 17°、水 14°（逆行 12°）、木 11°、金 10°（逆行 8°）、土 15°）；Retrograde。
6. Vimshottari Dasha：以月亮 Nakshatra 的主星起运，年限 Ketu 7、Venus 20、Sun 6、Moon 10、Mars 7、Rahu 18、Jupiter 16、Saturn 19、Mercury 17（顺序如此循环）；出生时已过比例 = 月亮在 Nakshatra 内已走的比例，剩余年限 = 总年限 × (1 − 比例)；Antardasha 按同序列、比例分配。输出至出生后 120 年；采用 365.25 天/年。
7. Yoga 检测（§1 列表），每条给判定条件常量。
8. Panchang（给定日期与地点）：Tithi = `floor(((moonLon − sunLon) mod 360) / 12) + 1`；Nakshatra（月）；Yoga = `floor(((sunLon + moonLon) mod 360) / 13.3333)`；Karana = 半个 Tithi；Vara = 当日日出时的星期（日出用地点）。各要素给出结束时刻（迭代求解）。

## 5. 输出 Chart Schema

```ts
type AstroChart = {
  noonChart: boolean;
  jdUT: number; obliquity: number; houseSystem: 'placidus'|'whole_sign'|'equal'|'koch';
  bodies: Array<{ key: Body; lon: number; sign: Sign; degInSign: number; retro: boolean; speed: number; house: number|null; nearCusp?: boolean; anaretic?: boolean }>;
  angles: { asc: number; mc: number; dsc: number; ic: number } | null;
  houses: Array<{ index: 1..12; cusp: number; sign: Sign; ruler: Body }> | null;
  aspects: Array<{ a: Body; b: Body; type: AspectType; orb: number; applying: boolean; major: boolean }>;
  stats: { elements: Record<'fire'|'earth'|'air'|'water', number>; modalities: Record<'cardinal'|'fixed'|'mutable', number>; polarity: {...}; hemispheres: {...}; stelliums: Array<{ sign?: Sign; house?: number; bodies: Body[] }> };
  rulers: { chartRuler: Body | null; mutualReceptions: Array<[Body, Body]> };
  moonPhase: { name: string; angle: number };
};

type VedicChart = {
  noonChart: boolean; ayanamsa: number; jdUT: number;
  lagna: { sidLon: number; sign: Sign; nakshatra: Nakshatra; pada: number } | null;
  bodies: Array<{ key: VBody; sidLon: number; sign: Sign; degInSign: number; house: number|null; nakshatra: Nakshatra; pada: number; retro: boolean; combust: boolean; dignity: 'exalted'|'own'|'moolatrikona'|'debilitated'|'friend'|'neutral'|'enemy'; navamsaSign: Sign }>;
  houses: Array<{ index: number; sign: Sign; lord: VBody; occupants: VBody[] }> | null;
  moon: { nakshatra: Nakshatra; pada: number; lord: VBody; rashi: Sign };
  dasha: { sequence: Array<{ lord: VBody; from: string; to: string; current: boolean; antar: Array<{ lord: VBody; from: string; to: string; current: boolean }> }> };
  yogas: Array<{ key: string; bodies: VBody[]; houses: number[] }>;
  panchangAtBirth?: {...};
};
```

## 6. 可视化

### 西方圆盘（SVG，`<NatalWheel>`）
- 外环 12 星座（符号 + 元素底色低饱和），中环宫位分割线（ASC 在左 9 点钟方向固定，顺时针宫位编号逆时针递增——即标准占星轮，ASC 左、MC 上），行星符号沿内环按黄经放置，重叠时自动错位（最小角距 7°，向两侧推开，用引线指向真实位置），中心相位线（三分/六分蓝色、四分/冲红色、合绿色），度数刻度每 5°。
- 交互：悬停/点击行星高亮其相位线与解读锚点；切换宫位制实时重绘；"3D 模式"切换为 Three.js 天球（行星沿黄道带分布于球面，地平面与子午圈显示，可拖动旋转，自动降级见 03）。

### 吠陀盘
- **南印度**：4×4 固定星座格（左上第二格为白羊，顺时针），Lagna 格画斜线；行星缩写（Su Mo Ma Me Ju Ve Sa Ra Ke）+ 度数。
- **北印度**：菱形宫位固定（第 1 宫在上中），星座编号写入格中。
- D1/D9 并排（桌面）或切换（移动）。
- Dasha 时间轴：水平条，Mahadasha 分段颜色按行星，当前位置指针；点击展开 Antardasha。

## 7. 西方报告章节

| # | key | 标题 | 要点 | 触发 |
|---|---|---|---|---|
| 0 | `overview` | 星盘概览 / Overview | 太阳·月亮·上升三件套一句话（Big Three）；元素/模式倾向；三个关键词；五维评分 | sun, moon, asc, stats |
| 1 | `big_three` | 太阳、月亮与上升 / Sun, Moon & Rising | 三者分别的星座 + 宫位解读（无时间则无上升、无宫位） | |
| 2 | `planets` | 行星与人格面向 / Planets in Signs & Houses | 水金火：思维/关系/行动；木土：成长/责任；天海冥：世代主题简述 | bodies |
| 3 | `houses` | 十二宫人生领域 / Life Areas | 每宫的星座与落入行星简述；重点宫（有 ≥ 2 行星或命主星） | houses（无时间则章节替换为"宫位需要出生时间"说明） |
| 4 | `aspects` | 相位：内在对话 / Aspects | 主要相位按紧密度排序逐条（≤ 8 条），每条 80–120 字；相位格局（大三角、T 三角、大十字、风筝、Yod）检测与解读 | aspects |
| 5 | `love_career` | 感情与事业 / Love & Career | 金星、火星、7 宫、5 宫 → 感情；太阳、土星、10 宫、6 宫、MC → 事业 | |
| 6 | `patterns` | 星盘结构 / Chart Patterns | 星群、半球、象限、月相、互容、Anaretic | stats |
| 7 | `transits_now` | 当前行运 / Current Sky | 今日/本月外行星对本命关键点的主要相位（≤ 5 条） | transits |
| 8 | `summary_actions` | 总结 / Summary | 五条建议 + 免责声明 | |

## 8. 吠陀报告章节

| # | key | 标题 | 要点 |
|---|---|---|---|
| 0 | `overview` | 命盘概览 / Overview | 月亮星座（Rashi）+ Nakshatra 一句话；Lagna；当前 Mahadasha；关键词 |
| 1 | `moon_nakshatra` | 月亮与星宿 / Moon & Nakshatra | 27 星宿性格、象征、主星、Pada 修饰；吠陀以月亮为心灵核心的说明 |
| 2 | `lagna_planets` | 上升与行星 / Lagna & Planets | Lagna 星座与其主星状态；九曜逐个：所在宫与星座、Dignity、逆行/焦伤的通俗影响 |
| 3 | `houses` | 十二宫（Bhava）/ Houses | 重点宫位（1、4、7、10、2、11、5、9）及其主星落宫 |
| 4 | `yogas` | 瑜伽格局 / Yogas | 命中 yoga 逐条通俗解释 |
| 5 | `dasha` | 大运周期 / Dasha Periods | 当前 Mahadasha + Antardasha 含义；未来 3 个次运时间与主题；时间轴 |
| 6 | `navamsa` | 九分盘 / Navamsa | D9 中月亮、金星、Lagna 的位置对婚姻与内在力量的简述 |
| 7 | `summary_actions` | 总结 / Summary | 建议（含吠陀传统的"行为建议"如作息、颂念等以文化介绍方式呈现，不承诺效果）+ 免责声明 |

## 9. 核验与测试

参考：astro.com（西方）、Astro-Seek、Prokerala / Drik Panchang / Jagannatha Hora（吠陀）。

- Fixture A（1990-05-15 08:30 北京）：核对太阳 ≈ 金牛 24°、月亮星座与度数、ASC 与 MC、Placidus 宫头、Lahiri ayanamsa（1990 ≈ 23°43′）、月亮 Nakshatra 与 Dasha 起运主星。施工时把 astro.com 的结果填为期望值，容差：行星经度 ±0.1°，ASC/MC ±0.3°，宫头 ±0.5°。
- Fixture D（纽约夏令时）：核对 UT 换算正确（EDT = UTC−4）。
- Fixture E（无时辰，南半球悉尼）：noonChart；无宫位；吠陀月亮跨 Nakshatra 的提示逻辑。
- 相位检测：构造位置数组测试 9 种相位、容许度边界、applying 判定。
- 宫位制：Placidus 在高纬度（> 66°）退化 → 自动切换 Whole Sign 并 warning `W_HOUSE_SYSTEM_FALLBACK`。
- Dasha：手算用例（月亮在 Rohini 第 2 Pada 的某时刻 → 月亮 Mahadasha 剩余比例）。
- Panchang：2026-10-04 新德里 vs Drik Panchang 的 Tithi/Nakshatra/Yoga/Karana 一致。

## 10. 知识库维度

西方：行星 × 星座（13 × 12 = 156）、行星 × 宫位（13 × 12 = 156）、上升星座 12、宫头星座 12 × 12 = 144（可用模板压缩为 12 星座在 12 宫领域的组合句）、相位 10 行星两两 × 5 相位 ≈ 225（金木土等慢行星之间用世代级简短版）、格局 6、元素/模式偏向 14、月相 8 → 约 **700 条**，其中相位与宫头可用"句式模板 + 变量"压缩实际写作量。
吠陀：Nakshatra 27 × Pada 4（Pada 为短修饰）、行星 × 星座 9 × 12 = 108、行星 × 宫 9 × 12 = 108、Lagna 12、宫主星落宫 12 × 12 = 144（模板化）、Dasha 主星 9 + 次运 81（模板化）、Yoga 12、Dignity/Combust 状态文案 ~30 → 约 **450 条**。
