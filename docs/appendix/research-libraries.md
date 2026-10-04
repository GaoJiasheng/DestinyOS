# 算命网站（TypeScript / Next.js）排盘与基础库选型调研报告

核实日期：2026-10-04。npm 版本/发布时间/许可证来自 npm registry API（`registry.npmjs.org/<pkg>`），周下载量来自 `api.npmjs.org/downloads/point/last-week/<pkg>`（统计区间 2026-09-27 ~ 2026-10-03），GitHub 星数/最近推送来自 GitHub REST API（`gh api repos/...`）。README/文档内容均为实际抓取。未能核实的点会明确标注"未核实"。

---

## 0. 结论速览（推荐选型表）

| 领域 | 推荐 | 理由 | 备选 | 主要风险 |
|---|---|---|---|---|
| 农历 / 节气 / 干支 / 八字（四柱、十神、藏干、纳音、大运、流年、小运、流月、胎元命宫） | **lunar-typescript**（6tail） | MIT、零依赖、自带 `.d.ts`、ESM+CJS、周下载 9.4 万、API 与 lunar-javascript 完全一致且文档同一份；`EightChar.getYun(gender, sect)` 直接给出起运与大运/流年/小运/流月 | tyme4ts（同作者"升级版"，2026-10-03 仍在发版，但八字运限 API 需再核）；lunar-javascript（无类型） | 不支持真太阳时（官方 FAQ 明示"暂不支持"）；八字神煞（天乙贵人、桃花、驿马等）仅有禄神/旬空/长生十二神，需自研 |
| 真太阳时 | **@openfate/true-solar-time** | MIT、TS、Meeus 均时差 + 经度差、IANA 时区、2026-03 发布 | 自研（EoT 公式 ~30 行） | 包较新、社区小（周下载 3.4k） |
| 紫微斗数 | **iztro** | MIT、TS、4.2k★、周下载 3.4 万、2026-09 仍更新；`astro.bySolar/byLunar/withOptions`，返回 12 宫主星/辅星/杂耀、`horoscope()` 给大限/流年/流月/流日/流时；`astro.config()` 可切换四化/亮度/立春分年/晚子时/中州派 | fortel-ziweidoushu（中州派、32★、维护弱） | 输入仅到时辰 index（0–12），分钟/经度/真太阳时需在上游处理；多流派差异需配置 |
| 周易 64 卦卦辞爻辞数据 | **freizl/yijing `zh-TW/64gua.json`**（MIT；含卦辞/彖辞/大象/爻辞/小象，繁体）+ 自行简体化；或 **Johnson-Jia/liuyao-divination `data/zhouyi.json`**（MIT，简体，卦辞+爻辞） | 原文为公版古文；结构清晰、可直接 import | john-walks-slow/open-iching（无许可证）；corpora `hexagrams.json`（CC0 但为英文意译，无原文） | 数据仓库星数低、需自行校对原文；任何白话翻译/注释是现代作品，不可随意抓取 |
| 六爻 / 梅花易数 | **自研起卦 + `liuyao` npm 做纳甲/六亲/六神元数据** | 起卦逻辑简单（时间起卦、铜钱起卦）；`liuyao`（MIT、TS）提供 64 卦纳甲、世应、六神等；与 lunar 的日干支结合即可 | mingyu-core（功能全但 **AGPL**）；ChesterRa/mingpan（Apache-2.0，MCP 服务，可参考实现） | 六爻断卦规则（旺衰/用神）无现成 TS 库 |
| 奇门遁甲（时家） | **qimen-dunjia**（npm，MIT，拆补/符头置闰两法，依赖 lunar-javascript） | 唯一近期活跃的 npm 库（2026-08 发版，周下载 592），输出地盘/天盘/八门/九星/八神及格局 | taobi（MPL-2.0，拆补/茅山/均分，转盘；置闰 TODO、飞盘未完成，2024-09 停更）；kinqimen（Python，MIT，拆补/置闰/刻家/日家，需移植） | 库很新、7★；README 未明说转盘/飞盘，需用已知命例回归验证；无 TS 类型；输出键为繁体中文 |
| 西方占星 / 吠陀占星 星历 | **方案 A（商业闭源网站）：astronomy-engine**（MIT，±1′，纯 JS，浏览器/Node）+ 自研 Lahiri ayanamsa、宫位（Whole Sign/Placidus）、Nakshatra、Vimshottari；**方案 B（若接受 AGPL 或购买专业授权）：sweph**（Node N-API，预编译，TS，Swiss Ephemeris 2.10.03，全部 ayanamsa 与宫位制） | Swiss Ephemeris 为 AGPL/商业双授权，"在任何公共服务上线前必须选定授权"，AGPL 要求整个项目 AGPL；astronomy-engine 精度对占星足够且无授权风险 | swisseph-wasm（可跑浏览器、自带 1800–2400 星历，但许可标注混乱）；circular-natal-horoscope-js（Unlicense，含 7 种宫位制，但 2021 停更） | 方案 A 需自己实现宫位制与岁差（Placidus 需迭代算法）；方案 B 的 AGPL 传染或商业授权费用 |
| 吠陀专用库 | 无成熟 TS 库 → **自研**（Nakshatra = 恒星黄经 / 13°20′；Vimshottari 120 年周期按月亮 Nakshatra 余量起算） | astrology-insights（MIT）依赖老旧 mivion/swisseph 原生绑定、3★、无类型 | VedAstro（Python/MCP）、jyotish-api（C，GPL-3） | 自研需用标准案例校验 |
| 占星盘渲染 | **@astrodraw/astrochart**（MIT、TS、SVG） | 维护中（2026-04 推送）、周下载 3.2k | 自绘 SVG/Canvas | 样式定制需 fork |
| 塔罗牌面 | **Wikimedia Commons 1909 版 RWS 扫描**（公有领域：美国 1909 出版未续展；英/欧 2022-01-01 起 PD） | 法律状态清晰；文件如 `RWS_Tarot_00_Fool.jpg` 1,144×1,919 | metabismuth/tarot-json 自带 78 张 350×600 图（MIT 代码；图来自 data.totl.net） | **不要**使用 1971 US Games 重新上色版；"Rider-Waite"/"Rider" 为 US Games 商标，产品名避开 |
| 塔罗含义数据 | **ekelen/tarot-api `static/card_data.json`**（源自 Waite 1910《Pictorial Key》公版文本；但仓库本身无 LICENSE 文件）+ **dariusk/corpora `tarot_interpretations.json`**（CC0，含 light/shadow/keywords） | 一个公版原文、一个 CC0 现代关键词 | metabismuth/tarot-json（MIT） | tarot-api 仓库未声明许可证，建议只用其 PD 文本并自行整理 |
| 星表 / 星空 3D | **HYG v4.4**（Codeberg，CC BY-SA 4.0，119,614 星）过滤 mag<6.5 后以 Three.js `Points` 自绘 | 字段完整（ra/dec/dist/mag/ci/x,y,z/con/bayer/proper） | d3-celestial（BSD-3，2D 星图、含中国星官皮肤，但 d3 v3 时代、npm 2020 停更）；three-starmap（示例级） | CC BY-SA 的"相同方式共享"对衍生数据集生效；需署名 |
| 字体 | 中文正文 **Noto Serif SC**（OFL 1.1 = 思源宋体）；中文标题/手写感 **LXGW WenKai**（OFL 1.1）；西文标题 **Cinzel**（OFL 1.1）；西文正文 **Cormorant**（OFL 1.1）。全部可商用免费 | 均 OFL 1.1；Google Fonts 与 @fontsource 均可用 | 思源宋体官方包 | Google Fonts 在中国大陆不可达 → 用 `@fontsource/*` 或 `next/font` 自托管；LXGW 的 jsDelivr 包为第三方打包 |
| 经纬度 → 时区 | 服务端 **geo-tz**（MIT，timezone-boundary-builder 精确边界）；浏览器 **@photostructure/tz-lookup**（CC0，72KB） | geo-tz 精确但只能 Node；tz-lookup 小而快但随机点约 30% 与 geo-tz 不一致 | 原始 tz-lookup（2019 停更） | geo-tz 要常升级（时区边界变化） |
| 城市搜索 | **自托管 GeoNames `cities500.zip`**（CC BY 4.0，约 18.5 万城市，自带 timezone 字段） | 无速率限制、离线、可做自动补全 | Nominatim 公共服务（禁止自动补全、≤1 req/s）；GeoNames Web 服务（1 万 credits/天） | 需署名 GeoNames；中文地名需用 alternatenames 字段或另配数据 |

---

## 1. 农历 / 八字

### 1.1 lunar-javascript 与 lunar-typescript（6tail）的关系

两者同一作者（6tail），功能、API、文档完全相同；`lunar-typescript` 是 TypeScript 重写版，自带类型声明并提供 ESM/CJS 双入口，npm 描述文字逐字一致。官方文档统一在 https://6tail.cn/calendar/api.html （注意：该站 **TLS 证书已过期**，浏览器会告警）。快速开始页同时列出 `npm install lunar-javascript` 与 `npm i lunar-typescript` 两种方式，并推荐 CDN `https://cdnjs.cloudflare.com/ajax/libs/lunar-javascript/1.7.5/lunar.min.js`，说明 lunar-javascript 兼容 UMD 且"在 IE7 上也能正常工作"。
来源：https://6tail.cn/calendar/start.html ；https://github.com/6tail/lunar-javascript ；https://github.com/6tail/lunar-typescript

| 包 | 最新版本 / 发布 | 许可证 | 周下载 | TS | GitHub |
|---|---|---|---|---|---|
| `lunar-javascript` | 1.7.7 / 2025-11-05 | MIT | 53,892 | 无 `types` 字段，也无 `@types/lunar-javascript` | https://github.com/6tail/lunar-javascript 1,692★，最近推送 2025-11-05 |
| `lunar-typescript` | 1.8.6 / 2025-11-05 | MIT | 94,258 | `./dist/index.d.ts`；main `./dist/index.cjs`，module `./dist/index.mjs` | https://github.com/6tail/lunar-typescript 372★，最近推送 2026-08-13 |
| `tyme4ts` | 1.5.3 / 2026-10-03 | MIT | 12,347 | `./dist/lib/index.d.ts` | https://github.com/6tail/tyme4ts 509★，最近推送 2026-10-03 |

均零运行时依赖（registry `dependencies` 为空），可在浏览器运行。

### 1.2 核心 API（摘自官方文档）

实例化（https://6tail.cn/calendar/solar.new.html 、lunar.new.html）：

```js
Solar.fromYmd(year, month, day)
Solar.fromYmdHms(year, month, day, hour, minute, second)
Solar.fromDate(date)
Solar.fromJulianDay(julianDay)
Solar.fromBaZi(yearGanZhi, monthGanZhi, dayGanZhi, timeGanZhi, sect, baseYear)  // 八字反推阳历
Lunar.fromYmd(lunarYear, lunarMonth, lunarDay)
Lunar.fromYmdHms(lunarYear, lunarMonth, lunarDay, hour, minute, second)
Lunar.fromDate(date)
```

八字（https://6tail.cn/calendar/lunar.bazi.html ）：

```js
var lunar = Lunar.fromDate(new Date());
var d = lunar.getEightChar();          // EightChar 对象（旧的 getBaZi() 系列已标"过时"）
d.getYear() / getMonth() / getDay() / getTime()            // 四柱干支
d.getYearGan(), d.getYearZhi()
d.getYearHideGan()      // 地支藏干，返回 1~3 个（本气、中气、余气）
d.getYearWuXing(), d.getYearNaYin()
d.getYearShiShenGan()   // 天干十神
d.getYearShiShenZhi()   // 地支十神（1~3 个）
d.getYearDiShi()        // 地势（长生十二神）
d.getYearXun(), d.getYearXunKong()   // 旬、旬空(空亡)
d.getTaiYuan(), d.getMingGong(), d.getShenGong()   // 胎元、命宫、身宫
```

早晚子时流派：

> 流派1认为晚子时日柱算明天，流派2认为晚子时日柱算当天，两种流派都认为晚子时时柱算明天。当不设置流派时，默认采用流派2。
> `.getSect()` / `.setSect(sect)`（1 或 2）

起运与大运：

```js
var yun = d.getYun(1);          // getYun(gender, sect)：gender 1 男 0 女；sect 1/2，默认 1
yun.getStartYear(); yun.getStartMonth(); yun.getStartDay(); yun.getStartHour(); // 流派1 不支持小时
yun.getStartSolar();            // 起运阳历日期
var daYunArr = yun.getDaYun();  // 10 个元素：[0]=出生年，[1]=起大运，之后每 10 年
daYun.getStartYear() / getEndYear() / getStartAge() / getEndAge() / getIndex() / getGanZhi()
daYun.getLiuNian()  // 流年表：getYear() getAge() getIndex() getGanZhi() getLiuYue() getXun() getXunKong()
daYun.getXiaoYun()  // 小运表
liuNian.getLiuYue() // 流月：getMonthInChinese() getIndex() getGanZhi()
```

文档对两种起运流派有明确说明（流派 1：3 天折 1 年、1 天折 4 月、1 时辰折 10 天；流派 2：按分钟数折算，4320 分钟 = 1 年，可精确到小时）。

tyme4ts 的八字入口不同：`LunarHour.fromYmdHms(2023,1,1,10,0,0).getEightChar()`；晚子时通过 `LunarHour.provider = new DefaultEightCharProvider() | new LunarSect2EightCharProvider()` 切换，并支持 `new EightChar("丁丑","癸卯","癸丑","辛酉").getSolarTimes(1900, 2024)` 八字反推。tyme 的节气算法引自寿星天文历 sxwnl。
来源：https://6tail.cn/tyme.html ；https://github.com/6tail/tyme4ts

### 1.3 真太阳时 / 神煞 的结论

- **真太阳时：lunar 不支持。** 官方 FAQ 原文：「【问】是否支持真太阳时？ 暂不支持。建议你使用平太阳时和真太阳时的转换代码，转换之后再传入lunar。」来源：https://6tail.cn/calendar/faq.html
- 推荐配合 `@openfate/true-solar-time`：4.0.2 / 2026-03-23，MIT，`dist/index.d.ts`，零依赖，周下载 3,419。API：`calculateTrueSolarTime(input, options)`、`getTrueSolarTimeFromInstant(input, options)`、`resolveCivilTime(input)`；参数 `longitude`（东正西负）、`timeZoneId`（IANA）、`algorithm: 'meeus' | 'approx'`；基于 Meeus《Astronomical Algorithms》均时差。来源：https://cdn.jsdelivr.net/npm/@openfate/true-solar-time@4.0.2/README.md ；https://github.com/openfate-ai/true-solar-time
- **八字神煞：** lunar 文档目录中与神煞相关的只有「禄」（"禄神为四柱神煞之一"，https://6tail.cn/calendar/lunar.lu.html ）、旬空、长生十二神；没有天乙贵人/文昌/桃花/驿马/华盖/羊刃等完整神煞模块。文档目录（https://6tail.cn/calendar/api.html ）中亦无"神煞"页。需自研查表（规则固定，工作量小）。

### 1.4 其他八字库核实

| 包 / 仓库 | 核实结果 |
|---|---|
| `bazi-calculator`（npm） | 0.1.0 / 2026-04-24，MIT，周下载 8，描述为 "MCP shim forwarding to xuanxue-bazi-matching"，仓库 jasonwagao-bit/m2m —— 只是转发器，**不是**可用的排盘库 |
| `@aharris02/bazi-calculator-by-alvamind` | 1.0.16 / 2025-05-09，MIT，TS，周下载 182；自述为 alvamind 版本的个人 fork，原仓库 `alvamind/bazi-calculator` 已 404 |
| `mingyu-core`（Brhiza/mingyu） | 0.4.0 / 2026-09-14，**AGPL-3.0-only**，TS，周下载 482，466★；依赖 tyme4ts、astronomy-engine；`generateBazi({ solarDate:'1995-08-18', solarTime:'09:30', gender:'男' })`、`generateLiuyao(new Date())`；覆盖八字/紫微/六爻/梅花/奇门/塔罗等。**AGPL 对闭源 SaaS 不可接受**。来源：https://github.com/Brhiza/mingyu |
| `fortel-ziweidoushu` | 这是紫微库，见 §2 |
| `ChesterRa/mingpan` | Apache-2.0，TS，MCP 服务：八字/紫微/六爻/梅花/大六壬/奇门，底层用 lunar-javascript + iztro，支持 `longitude` 真太阳时（"真太阳时四柱全量生效" v0.1.5+）。可作为实现参考。来源：https://github.com/ChesterRa/mingpan |

---

## 2. 紫微斗数：iztro

- npm：`iztro` 2.6.1 / 2026-09-03，MIT，`types: lib/index.d.ts`，周下载 33,773；依赖 `dayjs`、`i18next`、`lunar-lite`、`lunar-typescript`。
- GitHub：https://github.com/SylarLong/iztro 4,201★、680 forks，最近推送 2026-09-21。
- 文档站：**https://docs.iztro.com** （README 同时引用 https://ziwei.pro/posts/config-n-plugin.html ）；在线排盘 https://ziwei.pub 。
- 语言：zh-CN、zh-TW、en-US、ja-JP、ko-KR、vi-VN。
- 配套：`react-iztro` 1.5.0（2026-08-16）、`iztro-hook` 1.3.4（2026-08-15）。

API（https://docs.iztro.com/quick-start 与源码 `src/astro/astro.ts`）：

```ts
import { astro } from 'iztro';

// 阳历：YYYY-M-D，timeIndex 0~12（0=早子时…12=晚子时），gender '男'|'女'，fixLeap 默认 true
const astrolabe = astro.bySolar('2000-8-16', 2, '女', true, 'zh-CN');
// 农历：多一个 isLeapMonth
const astrolabe2 = astro.byLunar('2000-7-17', 2, '女', false, true, 'zh-CN');
// 统一入口
astro.withOptions({ type: 'solar' | 'lunar', dateStr, timeIndex, gender, isLeapMonth?, fixLeap?, language?, config? });

// 返回 FunctionalAstrolabe：
// solarDate, lunarDate, chineseDate, time, timeRange, sign, zodiac,
// earthlyBranchOfSoulPalace, earthlyBranchOfBodyPalace, soul('破军'), body('文昌'),
// fiveElementsClass('木三局'), palaces: Palace[]
// Palace: name, isBodyPalace, isOriginalPalace, heavenlyStem, earthlyBranch,
//         majorStars[], minorStars[], adjectiveStars[], changsheng12, boshi12,
//         jiangqian12, suiqian12, decadal/stage {range:[a,b], heavenlyStem}, ages[]

// 运限
astrolabe.horoscope(date?: string | Date, timeIndex?: number)
// → { solarDate, lunarDate,
//     decadal: { index, heavenlyStem, earthlyBranch, palaceNames[], mutagen[], stars[], age },
//     yearly:  { index, heavenlyStem, earthlyBranch, palaceNames[], mutagen[], stars[] },
//     monthly / daily / hourly: { index, heavenlyStem, earthlyBranch, palaceNames[], mutagen[] } }
```

全局配置与插件（v2.3.0+，https://docs.iztro.com/posts/config-n-plugin.html ；类型定义见 `src/data/types/astro.ts`）：

```ts
astro.config({
  mutagens: { 庚: ['太阳', '武曲', '天同', '天相'] },   // 四化
  brightness: { 贪狼: ['旺', ...12] },                   // 星耀亮度
  yearDivide: 'normal' | 'exact',       // v2.4.0 年分割：正月初一 / 立春
  horoscopeDivide: 'normal' | 'exact',  // v2.4.3 运限分割
  ageDivide: 'normal' | 'birthday',     // v2.4.5 小限分割
  dayDivide: 'forward' | 'current',     // v2.5.2 晚子时算来日 / 当日
  algorithm: 'default' | 'zhongzhou',   // v2.5.0 安星：通行版 / 中州派
});
astro.loadPlugin(plugin); astro.loadPlugins([...]); astrolabe.use(plugin);
```

已知局限：
- 输入只有时辰序号 `timeIndex`，没有分钟/经度参数；真太阳时需在调用前自行换算后再折算成时辰（iztro 文档中未出现"真太阳时"字样）。多个下游项目（ziweiknows/ziwei-chart、Renhuai123/ziwei-doushu）都是在 iztro 外层做"经度差 + 均时差"校正。来源：https://github.com/ziweiknows/ziwei-chart ；https://github.com/Renhuai123/ziwei-doushu
- 流派差异大，需通过 `config` 显式选择；默认不是中州派。

备选：
- `fortel-ziweidoushu` 1.3.4 / 2025-05-05，MIT，TS（`build/types/main.d.ts`），周下载 356，32★（https://github.com/airicyu/fortel-ziweidoushu ）。中州派，API：`DestinyBoard` + `DestinyConfigBuilder.withSolar()/withlunar()/withText()`，`Gender.M/F`，`getRuntimContext()` 给十年/流年/流月/流日。繁体输出，社区小。
- Renhuai123/ziwei-doushu：4,361★，Next.js 16 **应用**（非 npm 库），基于 iztro + lunar-javascript；代码 MIT，数据 CC BY 4.0，倪海厦讲义 CC BY-NC-SA（**不可商用**）；含 1100+ 格局规则与古籍原文（骨髓赋等），可作数据参考但注意分层许可。

---

## 3. 周易：64 卦数据、六爻与梅花易数

### 3.1 卦辞/爻辞 JSON（公版古文）

通过 GitHub code search（`"元亨利貞" extension:json` 189 条、`"元亨利贞" "初九" extension:json` 133 条）筛出可用仓库：

| 仓库 / 文件 | 许可证 | 结构（实际抓取） | 评价 |
|---|---|---|---|
| **freizl/yijing** `zh-TW/64gua.json` https://github.com/freizl/yijing | MIT，9★，2025-04 | 数组 64 项：`{ id:'111111', name:'乾', gua_ci:'乾：元亨，利貞。', tuan_ci:'大哉乾元…', da_xiang:'天行健，君子以自強不息。', yao_ci:[7 条含用九], xiao_xiang:[...], symbol:'䷀' }` | 最完整（卦辞+彖+大象+爻辞+小象），繁体；推荐 |
| **Johnson-Jia/liuyao-divination** `data/zhouyi.json` https://github.com/Johnson-Jia/liuyao-divination | MIT，6★，2026-07 | 以卦名为键 `"乾为天": { gua_ci:'元、亨、利、贞。', yao: { 初九:'潜龙勿用。', … 用九:… } }`；部分字带拼音括注 | 简体、含六爻用名（乾为天）；需清理拼音 |
| john-walks-slow/open-iching `iching/iching.json` https://github.com/john-walks-slow/open-iching | **无 LICENSE**，13★ | `{ id, name, symbol, array:[1,1,1,1,1,1], combination:['乾','乾'], scripture:'元亨利贞。', lines:[{id,type,name:'初九',scripture}] }` | 结构好但无许可证，只能当校对参考 |
| Guopop/chinese-philosophy `经/易类/周易.json` | 无 LICENSE | ctext 风格段落 + 注疏 | 原文公版，但注疏文本来源不明 |
| dariusk/corpora `data/divination/hexagrams.json` https://github.com/dariusk/corpora | **CC0** | 以二进制码为键，英文 `definition/description`（Ashley Blewer 撰写） | 仅英文意译，无原文 |
| kentang2017/ichingshifa（Python）https://github.com/kentang2017/ichingshifa | MIT，291★，2026-10 | 含 64 卦卦辭、爻辭、彖辭、象辭及納甲元數據 | 可移植数据/算法 |

法律提示：《周易》经传原文为公版；但现代白话翻译、注释、断语是受版权保护的作品，不要直接抓取（如倪海厦讲义为 CC BY-NC-SA）。

### 3.2 六爻 / 梅花易数库

- **`liuyao`**（npm）0.5.1 / 2026-08-22，MIT，TS（`./dist/index.d.ts`），周下载 80，依赖 `solarlunar`；仓库 https://github.com/baendlorel/kt-packages 。README：元数据"derived from sources such as Zeng Shan Bu Yi（增删卜易）"。API：
  ```ts
  import { Hexagram, Yao, SixGodList } from 'liuyao';
  const h = Hexagram.fromQuaternary('111222'); // 地天泰
  h.info.id; h.toDescriptionEn(); h.toChanged()?.info.id; SixGodList[0];
  new Yao(3) // 0 老阴(动) 1 少阳 2 少阴 3 老阳(动)
  Hexagram.fromYaos(yaos) / fromId('乾为天') / fromPalace(palace)
  ```
  提供卦宫、五行、世应、六神排序；**不含**卦辞爻辞原文、不含断卦。
- `mingyu-core`：`generateLiuyao(new Date())`，另含梅花——但 AGPL。
- `ChesterRa/mingpan`（Apache-2.0）含六爻、梅花排盘实现，可读源码参考。
- 梅花易数时间起卦：上卦 =（年支数+月+日）mod 8，下卦 =（年支数+月+日+时支数）mod 8，动爻 = 总和 mod 6 —— 规则简单，建议直接基于 lunar 的农历/时辰自研（多个 skill 仓库如 muyen/meihua-yishu 均为 Python，许可证 "other"，不宜复用）。
- `i-ching` 0.3.5（2017，MIT）、`iching` 1.0.0-4（2013，C++ addon）均已多年未更新，不建议。

---

## 4. 奇门遁甲

| 候选 | 核实结果 |
|---|---|
| **`qimen-dunjia`**（npm）https://github.com/arc119226/qimen_dunjia | 3.1.0 / 2026-08-21，MIT，周下载 592，7★，最近推送 2026-09-05；依赖 `lunar-javascript`；无 `types`。README："定局法提供**拆補**與**符頭**兩派並列（預設拆補）"，符頭法输出 `超接: 超神/接氣/正授`、`超接天數`、`上元符頭`。API：`generateChartByDatetime('2024011510', { 定局法: '拆補' \| '符頭' })`、`generateChartNow()`、`generateQimenChart()`（手动四柱）、`chartToObject(chart)`、`detectPatterns()`（11 类格局）、`assessVigor()`（旺衰，4 派）、内部 `calculateJuByChaiBu`。输出五层：地盤、天盤、八門、九星、八神。**README 未明确写"轉盤/飛盤"**，需用命例验证其为转盘排法。输出键为繁体中文。 |
| **taobi**（npm `taobi` 0.4.5 / 2024-09-21，MPL-2.0）https://github.com/Taogram/taobi | 58★。README 功能表：拆补法 ✔、茅山法 ✔、均分法（原创）✔、**置闰法 TODO**、**转盘 ✔、飞盘未完成**；节气用 VSOP87D 可精确到分钟，章动可选 IAU1980/IAU2000B。用法：`const { TheArtOfBecomingInvisible } = require("taobi"); new TheArtOfBecomingInvisible(new Date()).getCanvas()`。2024 后停更，无 TS。 |
| qfdk/qimen https://github.com/qfdk/qimen | 203★，MIT，Node + Express + EJS **应用**（非库），茅山派转盘，依赖 lunar-javascript，demo https://qm.qfdk.me 。可读源码。 |
| **kinqimen**（Python）https://github.com/kentang2017/kinqimen | 160★，README 称 MIT（GitHub license 字段为空），最近推送 2026-10-01，依赖 `sxtwl`。`Qimen(y,m,d,h,mi).pan(1)`（1=拆補，2=置閏）、`.pan_minute(2)`（刻家）、`.gpan()`（金函玉鏡日家）、`.overall()`。规则最全、作者系列库（kinliuren 大六壬、kintaiyi 太乙）成熟，可作为**回归测试基准**或移植源。 |
| mingyu-core / Horosa | AGPL，不采用 |

结论：JS 侧没有同时覆盖"拆补 + 置闰 + 转盘 + 飞盘"的成熟库。建议以 `qimen-dunjia`（拆补/符头）为主，用 kinqimen 的输出做交叉验证；若需飞盘需自研。

---

## 5. 星历与占星计算

### 5.1 Swiss Ephemeris 的许可证（对网站的影响）

LICENSE 原文（https://www.astro.com/ftp/swisseph/LICENSE ）与官网（https://www.astro.com/swisseph/swephinfo_e.htm ）：

> The software developer, who uses any part of Swiss Ephemeris in his or her software, must choose between one of the two license models, which are a) GNU Affero General Public License (AGPL) b) Swiss Ephemeris Professional License. **The choice must be made before the software developer distributes software containing parts of Swiss Ephemeris to others, and before any public service using the developed software is activated.** If the developer choses the AGPL software license, he or she must fulfill the conditions of that license, which includes the obligation to **place his or her whole software project under the AGPL** or a compatible license.

含义：只要网站（即使只在服务端）调用 Swiss Ephemeris 对公众提供服务，就触发 AGPL 的网络条款——要么整站开源为 AGPL，要么购买 Professional License（签约 + 在 Astrodienst 商店付费；**价格未在公开页面给出，本次未能核实**，需看 "Ordering License" 合同）。

技术参数（同页）：精度 0.001″；完整星历文件 97 MB（行星 27 MB、月球 70 MB）；无文件时回退 Moshier 半解析理论，精度 0.1″；覆盖 13201 BC – AD 17191。

Ayanamsa 与宫位制（程序员手册 https://www.astro.com/swisseph/swephprg.htm ）：
- `swe_set_sid_mode(sid_mode, t0, ayan_t0)`；`#define SE_SIDM_FAGAN_BRADLEY 0`、`SE_SIDM_LAHIRI 1`、`SE_SIDM_RAMAN 3`、`SE_SIDM_KRISHNAMURTI 5`、…、`SE_SIDM_LAHIRI_1940 43`、`SE_SIDM_LAHIRI_VP285 44`、`SE_SIDM_LAHIRI_ICRC 46`、`SE_SIDM_USER 255`；计算恒星黄道位置需置位 `SEFLG_SIDEREAL (64*1024)`。
- `swe_houses(tjd_ut, geolat, geolon, hsys)`、`swe_houses_ex(tjd_ut, iflag /* 0 or SEFLG_SIDEREAL */, ...)`；hsys：`'P'` Placidus、`'K'` Koch、`'O'` Porphyrius、`'R'` Regiomontanus、`'C'` Campanus、`'A'/'E'` Equal、`'W'` Whole sign，另有 `'B'` Alcabitus、`'T'` Polich/Page、`'S'` Sripati 等。

### 5.2 Node / 浏览器绑定对比

| 包 | 版本 / 发布 | 许可证（registry） | 周下载 | TS | 运行环境 | 星历文件 | 备注 |
|---|---|---|---|---|---|---|---|
| `swisseph`（mivion）https://github.com/mivion/swisseph | 0.5.17 / **2022-01-25** | registry 未填；GitHub GPL-2.0 | 3,977 | `./lib/swisseph.d.ts` | Node 原生（`nan` + `node-gyp` 现场编译） | 不带，`swe_set_ephe_path(__dirname+'/../ephe')` | 回调式 API：`swisseph.swe_calc_ut(julday_ut, swisseph.SE_SUN, flag, function(body){...})`；README 自述"寻找维护者"，基于 nan，新 Node 编译风险高 |
| **`sweph`**（timotejroiko）https://github.com/timotejroiko/sweph | 2.10.3-8 / 2026-08-24（对应 Swiss Ephemeris 2.10.03） | `(AGPL-3.0-or-later OR LGPL-3.0-or-later)`；≤2.10.0 为 GPL-2.0（`npm i sweph@gpl`）；持专业授权者可按 LGPL-3.0 | 23,458 | `./index.d.ts`，"100% API coverage"，intellisense 文档 | Node N-API；tarball 内含 `prebuilds/darwin-arm64、linux-arm64、linux-x64、win32-x64`；**不能在浏览器** | 不带（从 aloistr/swisseph `ephe/` 或 Astrodienst Dropbox 下载，`sepl_18.se1` 覆盖 1800–2400） | 签名（index.d.ts）：`calc_ut(tjd_ut: number, ipl: number, iflag: number): Calc`、`houses_ex2(tjd_ut, iflag, geolat, geolon, hsys: HouseSystems): HousesEx<12>`、`set_sid_mode(sid_mode, t0, ayan_t0)`（示例 `set_sid_mode(constants.SE_SIDM_LAHIRI, 0, 0)`）、`set_ephe_path(path)`、`julday(y, m, d, h, gregflag)`、`get_ayanamsa_ex_ut(tjd_ut, ephe_flag)`。局限：C 库单线程且设置为进程级（`set_ephe_path/set_sid_mode` 影响全进程），真正并行需 child_process |
| `swisseph-wasm`（prolaxu）https://github.com/prolaxu/swisseph-wasm | 0.1.0 / 2026-07-21 | registry/LICENSE 写 **GPL-3.0-or-later**；README 又称"GPL for non-commercial"——与上游 AGPL/专业双授权**不一致**，法律上不可靠 | 2,391 | `types/index.d.ts` | 浏览器（Chrome 61+ 等）+ Node 14+，WebAssembly | **自带** `wasm/swisseph.data`（README：约 2.1 MB，约 1800–2400 年） | `const swe = new SwissEph(); await swe.initSwissEph(); const jd = swe.julday(2023,6,15,12); swe.calc_ut(jd, swe.SE_SUN, swe.SEFLG_SWIEPH) // Float64Array`；`swe.set_sid_mode(swe.SE_SIDM_LAHIRI,0,0)` 后加 `SEFLG_SIDEREAL`；`houses(jd, lat, lon, hsys)`、`houses_ex2(...)`。37★、项目很新 |
| `ephemeris`（hemantgoswami）https://github.com/hemantgoswami/ephemeris | 3.2.1 / 2026-08-26 | GPL-3.0 | 1,098 | `index.d.ts` | 纯 JS（Moshier） | 不需要 | GPL 传染，不建议 |

### 5.3 纯 JS 开源天文库

| 包 | 版本 / 发布 | 许可证 | 周下载 | TS | 浏览器 | 精度/能力 |
|---|---|---|---|---|---|---|
| **`astronomy-engine`** https://github.com/cosinekitty/astronomy | 2.1.19 / 2023-12-14（仓库最近推送 2025-01-27，1,039★） | MIT | 206,642 | `./astronomy.d.ts`，源码本身是 TypeScript；CJS + ESM | 是 | README："designed to be small, fast, and accurate to within ±1 arcminute"，"Accuracy always within 1 arcminute of results from NOVAS"，压缩后 <120 KB（116,485 B），无外部依赖；支持 Sun/Moon/Mercury…Pluto/SSB/EMB 及 `DefineStar`。函数：`GeoVector`、`Ecliptic`、`EclipticGeoMoon`、`Equator`、`Horizon`、`SiderealTime`、`Observer`、`SunPosition`。**无 ayanamsa、无宫位制**（文档无相关函数）；无需星历文件 |
| `astronomia` https://github.com/commenthol/astronomia | 4.2.0 / 2025-08-30 | MIT | 1,253,655 | **无**类型（无 `types` 字段，也无 `@types/astronomia`） | 是（Chrome ≥45 等） | Meeus《Astronomical Algorithms》第二版的 Go→JS 移植；VSOP87 数据 `const {vsop87Bvenus} = require('astronomia').data`；模块 planetposition、moonposition、solar、julian、sidereal、precess、nutation、rise、coord；无宫位/岁差（指 ayanamsa）封装 |
| `circular-natal-horoscope-js` https://github.com/0xStarcat/CircularNatalHoroscopeJS | 1.1.0 / **2021-07-18** | Unlicense（公有领域） | 14,369 | `dist/types` | 是 | `new Origin({year, month /*0-based*/, date, hour, minute, latitude, longitude})`；`new Horoscope({origin, houseSystem:'whole-sign', zodiac:'tropical'|'sidereal', aspectPoints, aspectWithPoints, aspectTypes, customOrbs, language})`；宫位制 "Placidus, Koch, Topocentric, Regiomontanus, Campanus, Whole Sign, Equal House"；Moshier 星历；依赖 moment/moment-timezone/tz-lookup。**4 年未更新**，可作宫位算法参考（公有领域可直接抄） |

### 5.4 吠陀占星 JS 库

| 包 | 核实 |
|---|---|
| `astrology-insights` https://github.com/adarshsrii/astrology | 2.3.4 / 2026-09-20，MIT，周下载 77，3★，**无 types**；依赖 `swisseph`（mivion 原生，README 要求 C++ 编译器）、luxon、suncalc；`calculateBirthChart({date:'2000-01-01', time:'04:30', latitude, longitude, timezone:'Asia/Kolkata'})`，默认 `lahiri` + `whole_sign`，可选 KP；`calculateVimshottariDasha(utcDate, moon.nakshatra, moon.longitude % (360/27), depth)`，`NAKSHATRA_LORDS`；英/印地/尼泊尔语。功能全但工程质量与依赖链弱 |
| `vedic-astrology` | 1.0.6 / 2025-04-30，**GPL-2.0**，周下载 20，依赖 `ephemeris`、`swisseph-v2` |
| `jyotish` | 1.0.1 / 2020-05-24，ISC，周下载 10，依赖 `swisseph` |
| 其他语言 | VedAstro/VedAstro.Python（MIT）、teal33t/jyotish-api（C，GPL-3）、katelouie/stellium（Python，AGPL） |

结论：没有可直接采用的 TS 吠陀库。Nakshatra（27 × 13°20′，再分 4 pada）、Vimshottari（Ketu 7/Venus 20/Sun 6/Moon 10/Mars 7/Rahu 18/Jupiter 16/Saturn 19/Mercury 17 年，共 120 年，按出生时月亮在 Nakshatra 内的比例扣减首运）是确定性算术，建议基于 sidereal 黄经自研 100~200 行，并用 astrology-insights / Drik Panchang 做对照。

Lahiri 岁差若走 astronomy-engine 路线：需自己实现 Lahiri ayanamsa（Swiss Ephemeris 定义 Lahiri 为 1956-03-21 时 23°15′00.658″ 的 Chitrapaksha 标准，叠加一般岁差），并注意与 Swiss Ephemeris 的 `SE_SIDM_LAHIRI` 对齐做回归。

### 5.5 占星盘渲染

`@astrodraw/astrochart` 3.0.2 / 2023-08-17，MIT，TS（`./dist/project/src/index.d.ts`），周下载 3,256；GitHub https://github.com/AstroDraw/AstroChart 422★，最近推送 2026-04-02（前身 Kibo/AstroChart 224★ 已停更）。SVG 本命盘/过运盘。

---

## 6. 塔罗

### 6.1 Rider-Waite-Smith 牌面版权状态

- 维基百科（https://en.wikipedia.org/wiki/Rider%E2%80%93Waite_Tarot ）：原版在作者死后 70 年及以下保护期的国家均已进入公有领域，包括首发国英国；美国因 1909 年出版且未续展亦为公有领域；英/欧 2022-01-01 起 PD（Pamela Colman Smith 卒于 1951）。US Games Systems 对 "Rider-Waite" 与 "Rider" 持有商标，对 1971 年重新上色版持有版权，但不及于原始艺术。
- Wikimedia Commons 分类 https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck 注记："Although the original Rider–Waite tarot deck is public domain in both the United States and the United Kingdom (the source country), note that some colorized versions of the deck may remain copyrighted."
- 单文件示例 https://commons.wikimedia.org/wiki/File:RWS_Tarot_00_Fool.jpg ：1,144 × 1,919 px，标注 PD（1931 年前出版；Waite 1942 年卒作为雇佣作品著作权人）。命名模式 `RWS_Tarot_NN_Name.jpg`。
- 另一公认来源：sacred-texts.com 1909 版扫描 https://www.sacred-texts.com/tarot/xr/index.htm （ekelen/tarot-api README 推荐；本次抓取被 403 拦截，未直接核实页面内容）。
- 实践建议：使用 1909 原版扫描；产品文案避免使用 "Rider-Waite" 作为商品名（商标），可写 "Smith-Waite / RWS 1909 公版"。

### 6.2 牌义 JSON 数据集

| 数据集 | 许可证 | 结构（实际抓取） | 文本来源 |
|---|---|---|---|
| **ekelen/tarot-api** `static/card_data.json` https://github.com/ekelen/tarot-api | **仓库无 LICENSE 文件**（GitHub license API 404）；408★，最近推送 2023-12 | `{ nhits, cards:[78] }`，每张：`type:'major'|'minor'`, `name_short:'ar01'`, `name`, `value`, `value_int`, `suit`, `meaning_up`, `meaning_rev`, `desc` | A.E. Waite《The Pictorial Key to the Tarot》(1910，公版) 解析而来；在线 API https://tarotapi.dev |
| **dariusk/corpora** `data/divination/tarot_interpretations.json` https://github.com/dariusk/corpora | **CC0 1.0**（README："I have chosen to CC0 license this"），5,116★ | `{ tarot_interpretations:[78] }`，每张：`name`, `rank`, `suit`, `keywords[]`, `meanings:{light[], shadow[]}`, `fortune_telling[]` | Mark McElroy《A Guide to Tarot Meanings》 |
| metabismuth/tarot-json https://github.com/metabismuth/tarot-json | MIT，77★ | `tarot.json` + `tarot-images.json`；78 张 350×600 图共 7.37 MB，来自 data.totl.net | README 说 "public domain in the US, but not currently in the EU"（已过时，EU 2022 起 PD） |

---

## 7. 星空与 3D

### 7.1 HYG 星表

- GitHub 仓库 https://github.com/astronexus/HYG-Database 已于 2025-02-14 归档（788★），README："The HYG database is now hosted at https://codeberg.org/astronexus/hyg"。
- Codeberg 当前版本：**HYG v4.4，119,614 星**；另有 AT-HYG v3（HYG-like 子集 118,971 星）；最近提交 2026-07-12。
- 许可证："This work is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License"（CC BY-SA 4.0）。来源：https://codeberg.org/astronexus/hyg 、`data/hyg/README.md`
- 字段（`data/hyg/README.md`）：`id, hip, hd, hr, gl, bf, proper, ra, dec`（J2000）, `dist`（秒差距）, `pmra, pmdec`（mas/yr）, `rv`（km/s）, `mag, absmag, spect, ci`（B−V）, `x, y, z`（笛卡尔，pc）, `vx, vy, vz`, `rarad, decrad, pmrarad, pmdecrad`, `bayer, flam, con`（星座缩写）, `comp, comp_primary, base`, `lum`（太阳光度倍数）, `var, var_min, var_max`。
- 影响：BY-SA 意味着你发布的过滤/转换后的星表子集也需以 CC BY-SA 共享并署名（代码本身不受影响）。

### 7.2 Three.js 星图示例

| 项目 | 核实 |
|---|---|
| mathiasbno/three-starmap https://github.com/mathiasbno/three-starmap | npm `three-starmap` 0.0.5 / 2023-09-05（registry 标 MIT，但 GitHub 仓库 license 字段为空），11★；HYG 约 12 万星过滤到 8,913 颗（mag < 6.5），`import Stars from "three-starmap"; scene.add(new Stars())`；含 88 星座连线 |
| alexmensch/stellata | **AGPL-3.0**，AT-HYG 约 31.3 万星 GPU 渲染，WebGL2 + Three.js，仅可借鉴思路 |
| web.dev "Making 100,000 Stars" https://web.dev/100000stars/ | Chrome Experiment 技术文章（Three.js + HYG 思路） |
| Physicslibrary/Threejs-VR-Hipparcos | Hipparcos 119,617 星 VR 示例 |

建议：直接用 HYG CSV → 过滤 mag<6.5 → 预计算单位球面坐标与 B−V 颜色 → Three.js `Points` + 自定义 ShaderMaterial；工作量约一两天，避免引入无许可证/示例级依赖。

### 7.3 d3-celestial

npm `d3-celestial` 0.7.35 / **2020-11-05**，BSD-3-Clause，周下载 1,394，依赖 `d3`；GitHub https://github.com/ofrohn/d3-celestial 747★，最近推送 2024-08-12。`Celestial.display(config)`；星到 6 等（可换数据集）、深空天体、星座线/边界、银河、行星、60+ 投影、黄道/银道坐标；数据源 XHIP、SAC、IAU 星座、Stellarium 星空文化（含中国星官）。局限：基于旧版 d3（v3 时代 API）与 Canvas，与 React/Next 集成需包裹；npm 近 6 年未发版。

---

## 8. 字体（中英双语、可商用免费）

| 字体 | 许可证（核实） | CDN / 分发 |
|---|---|---|
| **Noto Serif SC**（= 思源宋体 Source Han Serif，Google 品牌版） | SIL OFL 1.1（Google Fonts 页面；github.com/notofonts/noto-cjk README；Serif 最新 2.003，ExtraLight–Black） | Google Fonts CSS2 API 可用（实测 `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700` 返回 @font-face）；自托管 `@fontsource/noto-serif-sc` 5.3.0（2026-07-19，OFL-1.1） |
| 思源宋体（Adobe 官方包）https://github.com/adobe-fonts/source-han-serif | 9,736★；与 Noto Serif CJK 同一字体（noto-cjk README 明示），OFL 1.1 | GitHub Releases |
| **LXGW WenKai 霞鹜文楷** https://github.com/lxgw/LxgwWenKai | OFL-1.1（GitHub license 字段），26,159★；README："无论是个人还是企业都可以自由使用，包括商用，无需付费"，禁止单独售卖字体文件 | jsDelivr 第三方 webfont 包实测可用：`https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css`（HTTP 200；npm 包 1.7.0 / 2023-02，包装层 MIT）；`lxgw-wenkai-lite-webfont`；`cn-fontsource-lxgw-wen-kai-gb-screen-r`（OFL）。注意「中文网字计划」旧 CDN `chinese-fonts-cdn.deno.dev` 已随 Deno Deploy Classic 下线（实测 404） |
| **Cinzel** https://github.com/NDISCOVER/Cinzel | OFL-1.1 | Google Fonts 可用（实测 `Cinzel:wght@400..900`）；`@fontsource/cinzel` 5.3.0 |
| **Cormorant** https://github.com/CatharsisFonts/Cormorant | OFL-1.1，642★ | Google Fonts 可用（实测 `Cormorant:wght@300..700`）；`@fontsource/cormorant` 5.3.0 |

部署建议：Google Fonts 域名在中国大陆不可达，Next.js 项目用 `next/font/local` + `@fontsource/*` 或自行子集化（CJK 需 unicode-range 分片）。

---

## 9. 时区与地理

### 9.1 经纬度 → 时区

| 包 | 版本 / 发布 | 许可证 | 周下载 | TS | 浏览器 | 说明 |
|---|---|---|---|---|---|---|
| `tz-lookup`（原版 darkskyapp） | 6.1.25 / **2019-12-05** | CC0-1.0 | 873,093 | 无 | 是 | 原仓库 github.com/darkskyapp/tz-lookup 已不存在（404） |
| **`@photostructure/tz-lookup`** https://github.com/photostructure/tz-lookup | 11.7.0 / 2026-09-16 | CC0-1.0 | 393,458 | `index.d.ts` | 是（`<script src="tz.js">`） | README："fork of darkskyapp/tz-lookup which was abandoned in 2020"；约 72 KB，比 geo-tz 小约 10 倍；`tzlookup(42.7235, -73.6931) // "America/New_York"`；精度权衡：随机点约 30% 与 geo-tz 不一致，人口居住区约 10% |
| **`geo-tz`** https://github.com/evansiroky/node-geo-tz | 8.1.9 / 2026-09-16 | MIT | 621,489 | `./dist/find-1970.d.ts` | **否**（"not intended to be used in the browser"，运行时从磁盘读大文件） | `find(47.650499, -122.350070) // ['America/Los_Angeles']`；入口 `geo-tz`（1970 后合并）、`geo-tz/now`（最小）、`geo-tz/all`；数据来自 timezone-boundary-builder（OSM）；README 强调务必用最新版 |

### 9.2 城市地名搜索

- **Nominatim 公共服务使用政策**（https://operations.osmfoundation.org/policies/nominatim/ ）：绝对上限 1 请求/秒；必须提供可识别应用的 HTTP Referer 或 User-Agent；**禁止自动补全**（"you must not implement such a service on the client side"）、禁止系统性/网格查询、禁止抓 details 页、禁止转售；批量地理编码结果必须本地缓存；须按 OSM 署名指南署名。→ 只适合低频、服务端、带缓存的调用，不适合搜索框联想。
- **GeoNames**：数据许可 CC BY 4.0（`download.geonames.org/export/dump/readme.txt`："This work is licensed under a Creative Commons Attribution 4.0 License"）；Web 服务按 `username` 限流：每日 10,000 credits、每小时 1,000 credits（https://www.geonames.org/export/ ）。离线包：`cities500.zip`（人口 >500 或 PPLA4 以上行政中心，约 185,000）、`cities1000.zip`（约 130,000）、`cities5000.zip`（约 50,000）、`cities15000.zip`（约 25,000）；字段 `geonameid, name, asciiname, alternatenames, latitude, longitude, feature class, feature code, country code, cc2, admin1..admin4 code, population, elevation, dem, timezone, modification date`。
- 建议：导入 cities500 到 Postgres/SQLite（含 `alternatenames` 以支持中文名、`timezone` 直接拿时区），前端自动补全走自家接口；页脚署名 GeoNames。

---

## 10. 推荐选型表（详细版）

| 领域 | 推荐 | 为什么 | 备选 | 风险 / 待办 |
|---|---|---|---|---|
| 农历/八字 | `lunar-typescript` 1.8.6 | MIT；TS；零依赖；浏览器/Node 皆可；`EightChar` 覆盖四柱/藏干/十神/纳音/地势/旬空/胎元命宫/起运/大运/流年/小运/流月；`setSect` 处理早晚子时；文档完整 | `tyme4ts`（更新更勤，设计更新，但 API 不同、需确认运限功能）；`lunar-javascript`（无类型） | 真太阳时需前置 `@openfate/true-solar-time`；神煞需自研；文档站证书过期（内容仍可访问） |
| 紫微斗数 | `iztro` 2.6.1 | MIT；TS；4.2k★活跃；多语言；`config` 支持流派切换；`horoscope` 覆盖大限到流时 | `fortel-ziweidoushu`（中州派实现对照） | 时辰粒度输入；流派默认值需与产品定义对齐；依赖 lunar-typescript（与八字共用一份日历，是优点） |
| 周易数据 | freizl/yijing `64gua.json`（MIT）→ 转简体后入库；辅以 Johnson-Jia/liuyao-divination `zhouyi.json`（MIT）校对 | 原文公版，结构齐全 | ichingshifa（Python，MIT）数据 | 要人工校对；不要引入无许可证仓库数据 |
| 六爻/梅花 | 自研起卦 + `liuyao`（MIT） | 规则简单；元数据可靠 | mingyu-core（AGPL，不用） | 断卦规则库自研 |
| 奇门 | `qimen-dunjia`（MIT） | 唯一活跃 npm 库，拆补/符头置闰 | `taobi`（MPL-2.0，转盘/茅山）；kinqimen（Python）做验证 | 转盘/飞盘未明示；无类型；繁体键名需映射 |
| 星历（商业闭源） | `astronomy-engine` + 自研 ayanamsa/宫位/Nakshatra/Dasha | MIT；±1′ 对占星足够；可在浏览器跑；200k 周下载 | `astronomia`（MIT，VSOP87 更高精度但无类型） | Placidus 需迭代算法；Lahiri 需与 Swiss Ephemeris 对齐验证 |
| 星历（接受 AGPL / 购买授权） | `sweph` 2.10.3-8 | 官方算法、全部 ayanamsa 与宫位制、预编译二进制、TS | `swisseph-wasm`（浏览器） | AGPL 传染或专业授权费（价格未公开）；星历文件需自备（约 1800–2400 年需 `sepl_18/semo_18`）；进程级设置 |
| 吠陀 | 自研 | 无成熟 TS 库 | astrology-insights 做对照 | 校验样本 |
| 占星盘图 | `@astrodraw/astrochart` | MIT、TS、维护中 | 自绘 | 定制样式 |
| 塔罗图 | Wikimedia Commons 1909 RWS | PD 清晰 | metabismuth/tarot-json 图包 | 商标用词；勿用 1971 版 |
| 塔罗文本 | corpora CC0 + Waite 1910 公版 | 许可清晰 | tarot-api JSON | tarot-api 仓库无许可证，只取其 PD 文本 |
| 星表/3D | HYG v4.4 + Three.js 自绘 | 字段全、许可清楚 | d3-celestial（2D） | CC BY-SA 署名与相同方式共享 |
| 字体 | Noto Serif SC / LXGW WenKai / Cinzel / Cormorant | 全 OFL 1.1 | 思源宋体官方包 | 大陆自托管；CJK 子集化 |
| 时区 | 服务端 `geo-tz`，前端 `@photostructure/tz-lookup` | 精度/体积各取所需 | — | geo-tz 升级节奏 |
| 地名 | 自托管 GeoNames cities500 | 无限流、含时区 | Nominatim（低频兜底） | 署名 |

---

## 11. 核实失败 / 需人工确认事项

1. Swiss Ephemeris Professional License 价格：官网仅给"Ordering License"入口，未公开数字；需下载合同或联系 order@astro.com。
2. `qimen-dunjia` 是否为转盘排法：README 未写明；需以 kinqimen / 商业软件命例做回归。
3. `tyme4ts` 的大运/流年 API：官方 tyme 文档中有 EightChar 与 EightCharProvider，但本次未逐项核对其运限（童限/大运）接口，选用前需确认。
4. sacred-texts.com 塔罗页面被 403 拦截，其公版说明依据 ekelen/tarot-api README 的转述。
5. `swisseph-wasm` 声称自带约 1800–2400 年星历（约 2.1 MB）来自其 README，未实际加载测试；其许可证标注（GPL-3）与上游（AGPL/商业）不一致，采用前需法律确认。
6. 所有 npm 周下载量为 2026-09-27 ~ 2026-10-03 单周数据，仅作相对活跃度参考。

---

## 附：主要来源 URL 汇总

- lunar：https://github.com/6tail/lunar-javascript 、https://github.com/6tail/lunar-typescript 、https://6tail.cn/calendar/api.html 、https://6tail.cn/calendar/lunar.bazi.html 、https://6tail.cn/calendar/faq.html 、https://6tail.cn/calendar/start.html 、https://6tail.cn/calendar/solar.new.html
- tyme：https://github.com/6tail/tyme4ts 、https://6tail.cn/tyme.html
- 真太阳时：https://github.com/openfate-ai/true-solar-time 、https://cdn.jsdelivr.net/npm/@openfate/true-solar-time@4.0.2/README.md
- iztro：https://github.com/SylarLong/iztro 、https://docs.iztro.com/quick-start 、https://docs.iztro.com/posts/config-n-plugin.html 、https://github.com/SylarLong/iztro/blob/main/src/data/types/astro.ts
- 紫微备选：https://github.com/airicyu/fortel-ziweidoushu 、https://github.com/Renhuai123/ziwei-doushu 、https://github.com/ziweiknows/ziwei-chart
- 周易数据：https://github.com/freizl/yijing 、https://github.com/Johnson-Jia/liuyao-divination 、https://github.com/john-walks-slow/open-iching 、https://github.com/dariusk/corpora 、https://github.com/kentang2017/ichingshifa
- 六爻：https://github.com/baendlorel/kt-packages 、https://www.npmjs.com/package/liuyao 、https://github.com/ChesterRa/mingpan 、https://github.com/Brhiza/mingyu
- 奇门：https://github.com/arc119226/qimen_dunjia 、https://github.com/Taogram/taobi 、https://github.com/qfdk/qimen 、https://github.com/kentang2017/kinqimen
- Swiss Ephemeris：https://www.astro.com/swisseph/swephinfo_e.htm 、https://www.astro.com/ftp/swisseph/LICENSE 、https://www.astro.com/swisseph/swephprg.htm 、https://github.com/aloistr/swisseph/tree/master/ephe
- 绑定：https://github.com/timotejroiko/sweph 、https://github.com/mivion/swisseph 、https://github.com/prolaxu/swisseph-wasm 、https://github.com/hemantgoswami/ephemeris
- 纯 JS 天文：https://github.com/cosinekitty/astronomy 、https://github.com/commenthol/astronomia 、https://github.com/0xStarcat/CircularNatalHoroscopeJS
- 吠陀：https://github.com/adarshsrii/astrology 、https://www.npmjs.com/package/vedic-astrology 、https://www.npmjs.com/package/jyotish
- 盘图：https://github.com/AstroDraw/AstroChart
- 塔罗：https://en.wikipedia.org/wiki/Rider%E2%80%93Waite_Tarot 、https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck 、https://commons.wikimedia.org/wiki/File:RWS_Tarot_00_Fool.jpg 、https://github.com/ekelen/tarot-api 、https://github.com/metabismuth/tarot-json
- 星表/星图：https://codeberg.org/astronexus/hyg 、https://github.com/astronexus/HYG-Database 、https://github.com/ofrohn/d3-celestial 、https://github.com/mathiasbno/three-starmap 、https://web.dev/100000stars/
- 字体：https://fonts.google.com/noto/specimen/Noto+Serif+SC/about 、https://github.com/notofonts/noto-cjk 、https://github.com/lxgw/LxgwWenKai 、https://github.com/NDISCOVER/Cinzel 、https://github.com/CatharsisFonts/Cormorant 、https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css
- 时区/地理：https://github.com/photostructure/tz-lookup 、https://github.com/evansiroky/node-geo-tz 、https://operations.osmfoundation.org/policies/nominatim/ 、https://www.geonames.org/export/ 、https://download.geonames.org/export/dump/readme.txt
