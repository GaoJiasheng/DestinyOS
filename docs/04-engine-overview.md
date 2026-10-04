# 04 · 排盘引擎总览（@tianji/engine）

> 各体系的具体算法见 `systems/` 目录。本文定义所有体系共享的输入规范化、时间处理、流派决策和输出约定。

## 1. 设计目标

1. **确定性**：相同输入 + 相同 `engineVersion` + 相同 `seed` 必须得到字节相同的输出。随机类体系（塔罗、随机起卦）用用户传入或服务端生成的 `seed` 驱动伪随机数（xoshiro128**），从不使用 `Math.random()`。
2. **纯函数、无 IO**：不读数据库、不发请求、不读系统时钟（`now` 必须由调用方传入）。
3. **可核验**：每个体系的输出包含足够的中间量（如八字的节气时刻、占星的儒略日与 ayanamsa 值），让人能对照第三方排盘站排查差异。
4. **流派显式**：所有可能有分歧的规则都是 `options.school` 里的显式参数，带默认值，输出 `meta.schoolUsed` 回显实际采用值。
5. **浏览器可运行**：无 Node 专有依赖；星历数据若需文件则打包为 JSON/二进制资源。

## 2. 输入规范化：从用户输入到 NormalizedBirth

### 2.1 用户输入（BirthInput，Zod schema 在 @tianji/shared）

```ts
type BirthInput = {
  calendar: 'gregorian' | 'lunar';
  // gregorian
  year: number; month: number; day: number;             // 公历或农历年月日
  isLeapMonth?: boolean;                                 // 仅 lunar
  hour?: number; minute?: number;                        // 0–23, 0–59；缺省表示未知
  timeUnknown: boolean;                                  // true 时忽略 hour/minute
  place?: {
    name: string;                                        // 用户看到的地名（存储加密）
    lat: number; lng: number;                            // WGS84
    tz: string;                                          // IANA，如 'Asia/Shanghai'
  };
  gender: 'male' | 'female' | 'unspecified';
};
```

校验规则：
- 年份范围 1900–2100（lunar 库与星历表覆盖范围，引擎按实际库能力收紧并在错误码中说明）。
- `lunar` 模式下月份 1–12，`isLeapMonth` 仅当该年该月确有闰月才允许，否则返回 `E_LUNAR_NO_LEAP_MONTH`。
- `place` 缺省时：时区按用户界面语言推断默认（zh → `Asia/Shanghai`，en → UTC），经纬度为 `null`，并产生 warning `W_NO_PLACE`。八字将不做真太阳时修正；占星按 `0°E`、`0°N` 以外的策略：无宫位盘（仅行星星座）。
- `timeUnknown = true`：`hour/minute` 置空；各体系行为见 §5。

### 2.2 NormalizedBirth

```ts
type NormalizedBirth = {
  // 公历本地钟表时间（用户输入的那套时间，含时区）
  local: { year, month, day, hour, minute, tz };      // hour/minute 在 timeUnknown 时为 null
  utc: string | null;                                   // ISO 8601，timeUnknown 时为该日 12:00 本地对应 UTC（用于占星无时盘）
  jd: number | null;                                    // 儒略日（UT），同上
  timeUnknown: boolean;
  place: { lat: number | null; lng: number | null; tz: string; name?: string };
  gender: 'male' | 'female' | 'unspecified';
  // 派生
  solarTime: {                                          // 真太阳时（仅八字、紫微、奇门用）
    enabled: boolean;                                   // 是否有经度可用
    offsetMinutes: number | null;                       // 经度差 + 均时差，单位分钟
    local: { year, month, day, hour, minute } | null;   // 修正后的本地时间
  };
  lunar: { year, month, isLeap, day, yearGanZhi, ... }; // 由 lunar 库算出的农历信息（不含时辰）
};
```

### 2.3 真太阳时（Apparent Solar Time）

东方三体系（八字、紫微、奇门）默认采用**真太阳时**，用户可在高级选项中关闭（`school.useApparentSolarTime: false` → 用钟表时）。

计算：
1. 标准时区中央经线 `L0`：由 `tz` 在该时刻的 UTC 偏移推出，`L0 = utcOffsetHours × 15`。例如 `Asia/Shanghai` 为 120°E；美国东部夏令时偏移 -4h → `L0 = -60°`。
2. 经度差修正：`Δ1 = (lng − L0) × 4` 分钟。
3. 均时差 `Δ2`（Equation of Time）：用标准近似公式（Spencer 1971 或 NOAA 公式）按当日计算，分钟。
4. 真太阳时 = 钟表时 + Δ1 + Δ2。
5. 修正后若跨日，年月日随之变化（这会影响日柱）。输出里同时给出修正前后时间与 Δ1、Δ2，UI 显示"已按出生地经度与均时差修正 +37 分钟"。

历史时区：使用 IANA tzdb（`Intl.DateTimeFormat` 或 `@date-fns/tz`）处理夏令时与历史偏移。注意 1986–1991 年中国大陆实行过夏令时，tzdb 已包含；输出 warning `W_DST_PERIOD` 让用户确认出生证明时间是否已含夏令时。

### 2.4 时辰（地支时）划分

真太阳时（或钟表时）→ 时辰：23:00–00:59 子，01:00–02:59 丑，……，21:00–22:59 亥。**早晚子时**流派见 §4。

## 3. 共享的历法与干支基础（engine/common）

- 公历 ↔ 农历（含闰月）转换、节气时刻（精确到分钟，基于太阳黄经 15° 倍数）、年柱以**立春**为界、月柱以**节**（非中气）为界，日柱按真太阳时修正后的日期，时柱按时辰。
- 六十甲子索引 `0 = 甲子`；天干 `0 = 甲`；地支 `0 = 子`。五行、阴阳、藏干、十神、纳音、长生十二宫、神煞表存为常量表。
- 五虎遁（年上起月）、五鼠遁（日上起时）实现为函数并有测试。
- 实现策略：**优先直接调用成熟库**（候选 `lunar-typescript`，见 appendix/research-libraries.md 的最终选型），引擎在其上封装统一类型；库不覆盖的（如真太阳时修正后再排盘、流派开关）在封装层处理。

## 4. 流派决策表（Owner 定：选最主流，UI 标注）

| 体系 | 分歧点 | 默认 | 可选 | 说明 |
|---|---|---|---|---|
| 八字 | 早子时/晚子时日柱 | `zi_unified`：23:00 起即算次日（日柱换日，时柱为次日子时） | `zi_split`：23:00–23:59 日柱不换，时柱按次日日干起子时 | `zi_unified` 为《渊海子平》与多数现代排盘软件（含 lunar 库默认 sect 2）的做法；两者在 UI 流派面板可切换 |
| 八字 | 年柱分界 | 立春时刻 | 农历正月初一 | 立春为主流 |
| 八字 | 月柱分界 | 节气时刻（精确到分） | 节气日 0 点 | 精确时刻 |
| 八字 | 起运 | 3 天 = 1 岁，阳男阴女顺行、阴男阳女逆行；精确到月 | 整岁法 | 主流 |
| 八字 | 大运数量 | 10 步（含起运前的"童限"标注） | | |
| 八字 | 身强弱 | 月令权重 + 得地得势得生综合评分法（见 systems/bazi.md §5） | | 透明输出各项得分 |
| 八字 | 神煞 | 常用 20 个 | | 列表见 bazi.md |
| 紫微 | 四化表 | 全书派（中州派）标准四化表 | 其他派别暂不开放 | 与 iztro 默认一致 |
| 紫微 | 闰月处理 | 闰月上半月算上月、下半月算下月 | 全部算下月 / 全部算上月 | iztro 支持的方式为准，默认选"上半归上、下半归下" |
| 紫微 | 真太阳时 | 启用 | 关闭 | |
| 梅花 | 时间起卦的年数 | 用地支序数（子=1 … 亥=12） | | 主流 |
| 梅花 | 报数起卦 | 两数：上卦 = n1 mod 8，下卦 = n2 mod 8，动爻 = (n1+n2+时辰数) mod 6；三数：动爻 = n3 mod 6 | | 0 余数取 8 / 6 |
| 梅花 | 先天八卦数 | 乾1 兑2 离3 震4 巽5 坎6 艮7 坤8 | | |
| 六爻 | 装卦纳甲 | 京房纳甲 | | |
| 六爻 | 六神起法 | 按日干：甲乙起青龙 … 壬癸起玄武 | | |
| 奇门 | 盘式 | 时家奇门、**转盘** | 飞盘（不做） | |
| 奇门 | 定局法 | **拆补法** | 置润法 / 茅山法（二期） | 拆补法在现代应用最广 |
| 奇门 | 寄宫 | 中五宫寄坤二宫 | 寄艮八宫 | |
| 奇门 | 阴阳遁 | 冬至后阳遁、夏至后阴遁，按节气 | | |
| 占星 | 宫位制 | Placidus | Whole Sign、Equal、Koch | |
| 占星 | 黄道 | 回归黄道（Tropical） | | |
| 占星 | 相位容许度 | 合 8°、冲 8°、三分 7°、四分 7°、六分 5°；日月 +2° | 用户可调 | |
| 占星 | 行星集 | 日月水金火木土天海冥 + 北交点（真）+ 凯龙 + 莉莉丝（平均） | | |
| 吠陀 | 岁差 | Lahiri（Chitrapaksha） | Raman、KP | |
| 吠陀 | 宫位制 | Whole Sign（等宫整宫，Rashi 为宫） | | 吠陀主流 |
| 吠陀 | 行星集 | 日月水金火木土 + Rahu/Ketu（平均节点） | 真节点 | |
| 吠陀 | Dasha | Vimshottari，120 年 | | |
| 塔罗 | 牌组 | RWS 78 张 | | |
| 塔罗 | 逆位 | 默认开启，每张 50% | 关闭 | 由 seed 决定 |

UI 规范：报告页"专业视图"标签下显示"流派与参数"面板，列出 `meta.schoolUsed` 全部项。

## 5. 时辰未知时的行为

| 体系 | 行为 | 输出 warning |
|---|---|---|
| 八字 | 排年月日三柱；时柱为 `null`；十神、藏干、神煞只算三柱；身强弱评分注明"缺时柱，置信度降低"；大运按不含时柱的规则正常起运（起运需出生时刻到节气的时间差，缺时间时按当日 12:00 计算并说明误差 ±1 年内） | `W_NO_HOUR_PILLAR` |
| 紫微 | **不可排盘**。返回 `E_REQUIRES_BIRTH_TIME`，前端显示说明与"用 12 时辰试排"入口（二期功能，一期仅文案） | — |
| 梅花 / 六爻 | 不依赖出生时间 | — |
| 奇门 | 不依赖出生时间（用起局时刻）；若用户选择"以出生时刻起局"模式则禁用 | — |
| 西方占星 | 按当地正午排盘；**不输出宫位、四轴、月亮度数标注"±6°"**；相位只算行星间 | `W_NOON_CHART` |
| 吠陀 | 同上；Nakshatra 以正午月亮位置给出并提示可能跨越相邻 Nakshatra（若月亮当日跨界则两者都列出）；Dasha 不输出次级时段 | `W_NOON_CHART` |
| 每日运势 | 八字部分用三柱；占星部分用日月；塔罗不受影响 | — |

## 6. 输出约定

```ts
type EngineResult<C> = {
  system: System;
  engineVersion: string;         // 来自 package.json，语义化版本
  computedAt: string;            // ISO（调用方传入的 now）
  input: NormalizedBirth | null; // 占卜类为 null
  chart: C;                      // 各体系 schema
  meta: {
    schoolUsed: Record<string, string | number | boolean>;
    warnings: Array<{ code: string; messageKey: string; params?: Record<string, unknown> }>;
    debug?: Record<string, unknown>;   // 中间量：节气时刻、JD、ayanamsa 等；生产环境保留，仅"专业视图"展示
  };
};
```

- 所有 `messageKey` 对应 next-intl 文案键，引擎不含任何自然语言字符串。
- 枚举值使用英文 snake 或拼音（如 `'jia'`, `'zi'`, `'zi_wei'`），**显示名**由前端通过文案表映射。规范表见 appendix/glossary.md。

## 7. 每日运势引擎（engine/daily）

输入：`NormalizedBirth`、目标日期 `localDate`（用户当前时区）、`seed = sha256(userId|localDate)`。

输出 `DailyChart`：

```ts
{
  date: { local: 'YYYY-MM-DD', tz, ganZhi: { year, month, day }, lunar: {...}, solarTerm?: {...} },
  bazi: {
    dayMasterRelation: TenGod,           // 流日天干对日主的十神
    branchRelation: 'combine'|'clash'|'punish'|'harm'|'break'|'none', // 流日地支 vs 日支
    elementBalance: { wood, fire, earth, metal, water },           // 流日五行叠加到原局后的分布
    favorable: Element[]; unfavorable: Element[];                   // 原局喜用忌
    todayElement: Element;                                          // 流日纳音五行或天干五行
    luckyColor: string[]; luckyNumbers: number[]; luckyDirection: string;
    goodHours: Array<{ branch: Branch; from: 'HH:mm'; to: 'HH:mm' }>;
    almanac: { yi: string[]; ji: string[] };                        // 黄历宜忌（库提供）
  },
  astro: {
    moonSign: Sign; moonPhase: {...}; sunSign: Sign;
    transits: Array<{ transiting: Planet; natal: Planet; aspect: Aspect; orb: number; applying: boolean }>; // 仅主要相位
    voidOfCourse?: boolean;
  },
  tarot: { card: TarotCard; reversed: boolean },
  vedic?: { tithi, nakshatra, yoga, karana, vara },
  scores: { career, wealth, love, health, social, overall },        // 0–100，由规则计算，UI 转星级
}
```

评分规则见 systems/daily.md。

## 8. 错误码（引擎层）

| code | 含义 |
|---|---|
| `E_INVALID_INPUT` | Zod 校验失败（details 带 issues） |
| `E_DATE_OUT_OF_RANGE` | 年份超出支持范围 |
| `E_LUNAR_NO_LEAP_MONTH` | 指定闰月不存在 |
| `E_REQUIRES_BIRTH_TIME` | 体系需要出生时间 |
| `E_REQUIRES_PLACE` | 体系需要出生地（占星有宫位模式） |
| `E_UNSUPPORTED_SCHOOL` | 不支持的流派参数 |
| `E_EPHEMERIS` | 星历计算失败 |

## 9. 测试基线：标准 Fixture

| Fixture | 输入 | 用途 |
|---|---|---|
| A | 1990-05-15 08:30，北京（116.40E, 39.90N, Asia/Shanghai），男 | 全体系主用例 |
| B | 1985-11-02 23:40，上海（121.47E, 31.23N），女 | 晚子时换日 |
| C | 2000-02-04 20:00，广州（113.26E, 23.13N），男 | 立春当日（2000-02-04 20:40 立春）之前 → 年柱仍为己卯 |
| D | 1988-07-10 14:00，纽约（-74.01W, 40.71N, America/New_York），女 | 夏令时 + 西经真太阳时 |
| E | 1995-08-20 timeUnknown，悉尼（151.21E, -33.87S），unspecified | 无时辰、南半球 |
| F | 农历 1993 年闰三月十五 06:00，成都 | 闰月输入 |
| G | 1960-01-01 00:30，香港 | 早子时边界 |

各体系文档给出这些 fixture 的期望结果（至少 A、B、C）。施工时先用参考站点核对期望值，写入 `packages/engine/test/fixtures/`。

## 10. 开源库选型（定稿，依据 appendix/research-libraries.md，2026-10-04 核实）

| 领域 | 选用 | 版本/许可 | 用法要点 | 本项目需自研的部分 |
|---|---|---|---|---|
| 农历、节气、干支、八字基础 | `lunar-typescript` | 1.8.6，MIT，零依赖，可跑浏览器 | `Solar.fromYmdHms(y,m,d,h,i,s).getLunar().getEightChar()`；`setSect(1|2)` 切换早晚子时（**`zi_unified` → sect 2（库默认），`zi_split` → sect 1**，施工时用 Fixture B 验证映射方向）；`getYun(gender, sect)` 得起运与大运、流年、流月；藏干/十神/纳音/长生/旬空/胎元/命宫均有 API | **真太阳时**（库官方 FAQ 明示不支持，须先换算再传入）；神煞（库仅禄神/旬空/长生，20 个神煞表自研）；身强弱评分、格局、喜用神；地支关系表 |
| 真太阳时 | `@openfate/true-solar-time` | 4.0.2，MIT，TS | Meeus 均时差 + 经度差，接受 IANA 时区 | 若该包不稳定，自研 NOAA 公式（约 40 行）并以该包为对照测试 |
| 紫微斗数 | `iztro` | 2.6.1，MIT，TS，4.2k★ | `astro.bySolar(dateStr, timeIndex 0–12, gender, fixLeap, lang)`；`astro.config({ algorithm: 'zhongzhou' | 'default', mutagens, brightness, yearDivide, dayDivide })`；`palace.horoscope(date)` 得大限/流年/流月/流日四化 | 真太阳时换算后再喂库；格局检测（25 个）；输出映射与完整性校验；**一期用 `algorithm: 'default'`（全书派四化）并在 UI 标注** |
| 周易原文数据 | `freizl/yijing` 的 64gua.json（MIT，繁体，含卦辞/彖/象/爻辞/小象）+ `Johnson-Jia/liuyao-divination` 的 zhouyi.json（MIT，简体） | | 合并为本项目 `hexagrams.yaml`，繁转简校对；白话由内容流水线生成 | 梅花起卦、体用、互卦变卦（简单，自研） |
| 六爻装卦 | `liuyao` npm 0.5.1（MIT，TS，源自《增删卜易》）作参考 | | `Hexagram.fromQuaternary('111222')`、六神列表 | 纳甲/六亲/世应/伏神自研并用该库做交叉测试；**禁止**使用 `mingyu-core`（AGPL） |
| 奇门遁甲 | `qimen-dunjia` 3.1.0（MIT，依赖 lunar-javascript） | | `generateChartByDatetime('YYYYMMDDHH', { 定局法: '拆補' })`，输出地盘/天盘/八门/九星/八神，含 `detectPatterns` | README 未明示转盘/飞盘，施工时先用 Python `kinqimen`（`pan(1)` 拆补）跑 20 个时刻做基准，若 `qimen-dunjia` 与基准一致则直接用，否则按 systems/qimen.md 自研（规则已完整给出） |
| 星历 | `astronomy-engine` | 2.1.19，MIT，<120KB，TS，±1′ | `Astronomy.GeoVector/Ecliptic/EclipticLongitude`、`MoonPhase`、`SearchRiseSet`、`SiderealTime` | 上升/天顶、Placidus/Whole Sign/Equal 宫位、Lahiri ayanamsa、平均交点、凯龙（用简化轨道根数或插值表并标注"近似"）、莉莉丝、Nakshatra、Vimshottari、Panchang；**不用 Swiss Ephemeris**（AGPL 需整站开源，商业授权价格不公开） |
| 占星盘图参考 | `@astrodraw/astrochart` 3.0.2（MIT） | | 仅作 SVG 布局算法参考，本项目自绘 | |
| 塔罗图片 | Wikimedia Commons 1909 Pamela Colman Smith 原版（美国公版；英/欧自 2022 公版） | | 下载 78 张高清，统一裁切；**勿用 1971 US Games 上色版**；"Rider-Waite" 是商标，站内称 "RWS 1909 公版牌" | 牌背自绘 |
| 塔罗文本 | `dariusk/corpora` tarot_interpretations.json（CC0） | | 作关键词种子 | 正文由内容流水线生成 |
| 星空数据 | **优先 Yale Bright Star Catalogue (BSC5，公版，9,110 星)**；需要更多星时用 HYG v4.4（CC BY-SA 4.0，需署名且衍生数据同许可） | | 预处理为 `stars.bin`（ra, dec, mag, ci 压缩为 Float32/Uint8），≤ 200KB | |
| 字体 | Noto Serif SC、LXGW WenKai、Cinzel、Cormorant Garamond（均 OFL 1.1） | `@fontsource/*` 自托管子集 | | |
| 时区 | 服务端 `geo-tz` 8.x（MIT）；前端 `@photostructure/tz-lookup`（CC0，72KB，精度略低仅作预填） | | | |
| 地名 | 自托管 GeoNames `cities500`（CC BY 4.0，含 timezone 字段），预处理后约 18.5 万条，服务端搜索 | | 页脚署名 GeoNames | |

**许可证红线**：禁止引入 AGPL/GPL 依赖（mingyu-core、stellata、vedic-astrology、swisseph-wasm）。CI 用 `license-checker` 白名单：MIT、ISC、BSD-2/3、Apache-2.0、OFL、CC0、CC-BY-4.0、MPL-2.0（仅限不修改源码的使用）。
