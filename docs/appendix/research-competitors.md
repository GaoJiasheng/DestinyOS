# 天机 / DestinyOS 竞品调研（部分交付版）

> 状态说明：本稿只包含**已经由本人用 WebFetch / WebSearch 实际核实**的内容。三组按产品逐条调研（中文产品 ×10、西方占星 ×7、塔罗+吠陀 ×8）被交给了并行子任务，在被要求提前交付时尚未返回，因此**第 2 节「逐产品分析」目前为空，不作任何凭记忆的补写**。已核实的 5 个专题问题答案见第 3 节。

## 1. 已核实来源一览

| 产品 / 页面 | 核实方式 | URL |
|---|---|---|
| astro.com 出生时间 FAQ | WebFetch 成功 | https://www.astro.com/cgi/xa.cgi/faq/fq_de_time_e.htm |
| CHANI「不知道出生时间」教程 | WebFetch 成功 | https://chani.com/astro-education/how-can-i-work-with-my-astrology-chart-if-i-dont-know-my-birth-time |
| Co-Star FAQ | WebFetch（经 r.jina.ai 代理）成功 | https://www.costarastrology.com/faq |
| Co-Star 首页 | WebFetch 仅取到 hero 文案 | https://www.costarastrology.com/ |
| iztro 官网 | WebFetch 成功 | https://iztro.com/ |
| ziwei.pub（iztro 演示站） | WebFetch 仅取到标题，页面为纯前端渲染，表单细节未核实 | https://ziwei.pub/ |
| 元亨利贞网 六爻排盘 | WebFetch 成功 | https://www.china95.net/paipan/liuyao/ |
| Drik Panchang 每日 panchang | 直连被 302 到 whitelist-login，经 r.jina.ai 代理成功 | https://www.drikpanchang.com/panchang/day-panchang.html |
| Prokerala 出生星盘表单 | WebFetch 成功 | https://www.prokerala.com/astrology/birth-chart/ |
| Cafe Astrology「未知出生时间」报告页 | 404（该 URL 不存在，未核实） | https://cafeastrology.com/natal-chart-report-unknown-birth-time.html |
| The Pattern 订阅价格 | WebSearch 摘要（App Store 文案） | https://apps.appfollow.io/ios/the-pattern/1071085727 ，https://www.bustle.com/life/pattern-app-review-features-price |
| Co-Star 每日板块（Power/Pressure/Trouble） | WebSearch 摘要（学生媒体报道） | https://www.thealabamian.com/app-spotlight-co-star/ |
| 中文八字 App 对未知时辰的处理 | WebSearch 摘要（App Store 文案） | https://apps.apple.com/uy/app/id1665624645 （问真八字排盘宝）；https://apps.apple.com/app/id1359657037 （查八字） |

## 2. 逐产品分析

**未完成。** 以下产品的「核心功能 / 首页与结果页组织 / 每日运势格式 / 表单设计 / 免费付费分层 / 广告位 / 分享 / 视觉风格 / 亮点 / 缺点」尚未经核实，不在此稿中给出结论：

- 中文：灵机文化（灵占天下）、测测、算命先生网、周公解梦类、问真八字、八字排盘宝、知命、Hey Luna、汉程网、第一星座网、美国神婆
- 英文：Co-Star（仅 FAQ 部分见第 3 节）、The Pattern（仅价格）、Sanctuary、CHANI（仅未知时辰处理）、astro.com（仅未知时辰 FAQ）、Cafe Astrology、Labyrinthos、Golden Thread Tarot、Biddy Tarot、Astro-Seek、Prokerala（仅表单）、AstroSage、Drik Panchang（仅 panchang 页字段）

已核实的零散事实：

### 元亨利贞网 · 六爻排盘（china95.net）
- 起卦方式：时间起卦（公历/农历 + 年月日时分，强调「时间精确到分钟」）、数字起卦、手动摇卦/铜钱、干支起卦；可选「占事类别」（婚姻、事业、财运、学业等）。
- 结果结构：本卦/变卦卦名、六亲、六神、世应、伏神、月建日辰、空亡。
- 页面：顶部/侧栏有多条 banner 广告，推广付费人工咨询；导航可跳转八字、紫微、奇门、梅花等其他排盘工具；排版为传统门户式、信息密集。
- 来源：https://www.china95.net/paipan/liuyao/

### iztro / ziwei.pub（紫微斗数开源排盘）
- iztro 自述为「轻量级紫微斗数排盘工具库」，演示站为 ziwei.pub；支持简中、繁中、日、韩、英、越 6 种语言；附带「星问 AI」解盘服务。
- 输出覆盖 12 宫、主星/辅星/杂曜、四化、大限/小限/流年、命宫身宫、五行局（官网文案）。ziwei.pub 具体表单（早晚子时、真太阳时、出生地）未取到页面内容，**未核实**。
- 来源：https://iztro.com/ ，https://ziwei.pub/

### Prokerala · Birth Chart 表单
- 字段：Name、Gender（Male/Female 单选）、Birth Date（年 1901–2028 / 月 / 日 下拉）、Birth Time（12 小时制 时/分 + AM/PM）、Place of Birth（自动补全文本框）。
- 页面上未见时区、North/South Indian 盘式、Ayanamsa 选项，也**没有「不知道出生时间」选项**（时间为必填）。
- 结果页链接到：Rasi chart、Navamsa chart、Sade-Sati 报告、Western natal chart、Tamil Jathaka Kattam。表单上方区域无明显广告，下方为相关文章列表，风格简洁功能化。
- 来源：https://www.prokerala.com/astrology/birth-chart/

### Co-Star · FAQ 要点
- 商业模式：「100% 收入来自 à la carte 应用内购买，例如手动添加好友和高级星盘解读」；「Ask the Stars」首次免费，之后购买 credits；高级解读在 Settings 页随时可看。
- 好友：添加好友可看双方合盘与对方每日更新；手动添加好友是付费功能；左滑删除。
- 内容生成：用出生日期/时间/地点生成；「根据你过去在 App 内的行为选择要在首屏呈现的 transit」；不读取第三方数据；不出售数据。
- FAQ 中**没有**关于未知出生时间的条目。
- 来源：https://www.costarastrology.com/faq

### The Pattern · 价格
- 「Go Deeper+」自动续订订阅，起价 US$14.99/月（App Store 文案）；功能：Your Pattern、Timing（当前及未来行星周期）、Bonds（友情/爱情兼容性）、Custom Friends。
- 来源：https://apps.appfollow.io/ios/the-pattern/1071085727 ，https://www.bustle.com/life/pattern-app-review-features-price

## 3. 专题问题

### Q1. 做得最好的「每日运势」页面长什么样？
**未完成核实**，只能给出已核实片段：
- Co-Star 每日首屏含「Day at a glance」一句格言式提示（并作为每日推送），以及按生活领域标注 Power / Pressure / Trouble 三态的区块（报道举例：社交、性与爱、创造力为 Power，工作为 Pressure，自我为 Trouble），每日随星象变化；点开可看该领域为何如此的 transit 解释。来源：https://www.thealabamian.com/app-spotlight-co-star/ ，https://www.inverse.com/article/54991-costar-astrology-app-how-it-works （Inverse 仅提到「Day at a glance」推送与「problem areas」列表）。
- 其余产品（astro.com Personal Daily Horoscope、Cafe Astrology、测测、灵机等）板块顺序尚未核实。

### Q2. 「八字/星盘结果页」如何平衡专业排盘与通俗解读？
**未完成核实。** 仅 iztro 官网表明其产出为纯专业盘（12 宫 + 星曜 + 四化 + 运限），并以独立「星问 AI」提供通俗解读（https://iztro.com/）；元亨利贞六爻页则为纯专业输出 + 付费人工咨询广告（https://www.china95.net/paipan/liuyao/）。

### Q3. 塔罗在线抽牌交互模式
**未完成核实**（Labyrinthos / Golden Thread / Biddy Tarot 页面尚未访问）。不在此凭记忆给出模式分类。

### Q4. 如何处理「不知道出生时辰」？（已核实）
| 产品 | 做法 | 来源 |
|---|---|---|
| astro.com | 时间字段可选「unknown」，自动按 **12:00 正午**计算；进阶玩法：在分钟栏填「00u」或「u」标记为假设时间，星盘上显示如「18:00 hyp」且**不画宫位**。FAQ 强调上升点约每 4 分钟移动 1°，15 分钟即可能改变解读。 | https://www.astro.com/cgi/xa.cgi/faq/fq_de_time_e.htm |
| CHANI | App **没有**「不知道出生时间」选项。官方教程给两种变通：① 填 12 PM，可看行星星座与相位，但上升、宫位、MC/IC/DC 不可用；② 按出生地日出时间填写，使太阳星座充当上升星座（即杂志式星座运势的做法）。并建议先查长版出生证明、家庭记录、问亲属，最后才做 rectification。 | https://chani.com/astro-education/how-can-i-work-with-my-astrology-chart-if-i-dont-know-my-birth-time |
| Co-Star | FAQ 无相关条目（未核实 App 内是否有「I don't know」开关）。 | https://www.costarastrology.com/faq |
| Prokerala | 出生时间为必填 12 小时制下拉，无「未知」选项。 | https://www.prokerala.com/astrology/birth-chart/ |
| 中文八字 App（问真八字排盘宝 / 查八字 等 App Store 文案） | 支持「时辰不详起盘」，仅凭年月日排出前六字；AI 对话类产品允许用户只说「早上/下午」等模糊时段，并在汇总里把时辰标为「未知」；多款强调按天文算法换算真太阳时。 | https://apps.apple.com/uy/app/id1665624645 ，https://apps.apple.com/app/id1359657037 |

对 DestinyOS 的直接启示（基于上表）：表单应提供显式「不知道时辰」开关；八字侧按「前六字 + 时柱留空」出盘并在解读中屏蔽时柱相关结论；星盘侧默认正午并隐藏宫位/上升，同时像 CHANI 一样给出「如何找回出生时间」的引导文案。

### Q5. 吠陀排盘/panchang 网站通常展示哪些要素？（Drik Panchang 已核实；排盘部分仅 Prokerala 表单）
Drik Panchang「Day Panchang」页（以 Houston 为例，12 小时制本地时间）字段顺序：
1. Sunrise / Moonrise / Moonset（示例：07:17 AM / 07:03 PM / 03:23 PM）
2. 核心五要素：Tithi（如 Garaja）、Yoga、Karana、Weekday（Raviwara）、Paksha（Krishna）
3. 纪年：Vikram Samvat（2083 Siddharthi）、Shaka Samvat、Gujarati Samvat
4. Lunar Month（Ashwina，分 Purnimanta/Amanta）
5. Mantri Mandala（年度行星职司：Raja、Mantri 等）
6. Rashi & Nakshatra（含换星时间和 Pada）
7. Ritu（Sharad）、Ayana（Dakshinayana）、昼长/夜长
8. 吉时：Brahma Muhurta、Pratah Sandhya、Vijaya Muhurta、Amrit Kalam、Nishita Muhurta
9. 凶时：Rahu Kalam、Yamaganda、Gulikai Kalam、Dur Muhurtam、Bhadra
10. Anandadi Yoga、Tamil Yoga
11. Nivas & Shool（Disha Shool 方位）
12. 其他历法：Kaliyuga 年、Ayanamsha、Kali Ahargana、Rata Die、Julian 日
13. Chandrabalam & Tarabalam（按星座的月亮/星宿吉力）
14. Panchaka Rahita Muhurta（逐时段 Panchaka 类型 + Udaya Lagna 上升星座切换）
- 大量 SVG 图标（Paksha、Nakshatra、季节、星座、方位、吉凶标记）；页面内无第三方广告，仅推广自家「Daily Panchang Subscription」「Muhurat Calculation Tool」等付费服务；地点显示为城市名并注明 DST 调整，选择机制未在抓取内容中出现。
- 来源：https://www.drikpanchang.com/panchang/day-panchang.html （经 r.jina.ai 代理读取）
- 吠陀出生盘（Rashi/D1、Navamsa/D9、Vimshottari Dasha、Nakshatra、Doshas、Ashtakavarga）在 Prokerala 的结果页仅核实到「Rasi chart、Navamsa chart、Sade-Sati、Western natal chart、Tamil Jathaka Kattam」入口（https://www.prokerala.com/astrology/birth-chart/）；AstroSage、Astro-Seek Vedic 未核实。

## 4. 技术备注
- drikpanchang.com 对非白名单地区直连返回 302 到 `/account/SG/whitelist-login.html`，需经代理读取。
- astro.com 部分 FAQ URL（`/faq/fq_fh_unkntime_e.htm`）返回浏览器校验页，应使用 `https://www.astro.com/cgi/xa.cgi/faq/fq_de_time_e.htm`。
- costarastrology.com 首页为 JS 渲染，WebFetch 仅能取到 hero 文案「Hyper-Personalized, Real-Time Horoscopes」。
