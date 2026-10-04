# 竞品调研（第三部分）：西方占星 App 与塔罗 / 吠陀站点逐产品摘要

> 调研日期 2026-10-04。本文为两份子调研报告的整理摘要（原始报告由调研代理口头交付，此处保留全部结论与来源 URL，删去过程描述）。未能直接访问的页面标注「未验证」。

## A. 西方占星产品

### Co-Star（costarastrology.com）
- 定位「hyper-personalized, social astrology」：简化本命盘、按行运生成每日更新、加好友看相容性、「Ask the stars」付费 AI 问答。宫位制 Porphyry。来源 https://www.costarastrology.com/faq
- **网页本命盘结果页结构**（实测 /natal-chart/19）：顶部再放一次表单 → 12 星座环形标签（装饰） → 按行星逐条卡片：`SUN / SCORPIO 19°12'33" / FIFTH HOUSE` + 60–110 词白话（行星通用含义 → 你的星座 → 你的宫位）。顺序 Sun → Ascendant → Moon → Mercury … Pluto。**无相位、无统计**。
- 每日：「Day at a Glance」一句箴言；Do ×3 / Don't ×3（刻意随机的短词，如 "do: extra cheese"）；生活领域 **Power / Pressure / Trouble 三态**（self、thinking & creativity、sex & love、social life、spirituality、routine）；按用户行为挑选展示的行运；每条后「was this useful?」。来源 https://www.vice.com/en/article/co-star-astrology-app-review/ 、https://hsdial.org/2024/01/22/app-of-the-month-co-star/
- 表单：网页 time 字段无「未知」选项；App 时间选择器可 Skip（默认值未验证）。
- 付费：100% 来自内购（Pro-Star $8.99/月、Advanced Chart $8.99、credits $2.99–6.99）。无第三方广告。
- 视觉：纯黑白、衬线细字、居中文本、黑白线描；被 Pratt 设计评论批评层级弱。来源 https://ixd.prattsi.org/2022/02/design-critique-co-star-iphone-app-2/
- 借鉴：Do/Don't 可截图格式；三态替代星级；三句式行星模板；网页免费排盘 + 邮件作为获客漏斗。

### The Pattern（thepattern.com）
- 完全不显示盘轮/行星/宫位名词，全部翻译为心理学语言；Timing 以「周期 + 起止时间」呈现。宫位制 Whole Sign。来源 https://www.thepattern.com/natalchart 、https://www.auraeastrology.com/blog/the-pattern-app-review-2026-an-astrologers-honest-opinion
- 官网表单有明确「I don't know my birth time」链接；有 DST 排错提示（「try adjusting your birth time by one hour」）。
- 付费 Go Deeper+ $14.99/月、$83.99/年，无免费试用。
- 弱点：黑箱、无法学占星、取消订阅投诉。

### Sanctuary（sanctuaryworld.co）
- 已转为通灵师按分钟计费市场（$4.44–19.99/min）。网页每日运势：单段 55–100 词、问句开头、紧扣当日行运，**无评分无幸运元素**。App 内同时给太阳与上升两版 + 「power emoji」。来源 https://www.sanctuaryworld.co/horoscopes/aries
- 借鉴：问句开头的超短运势；今日符号 emoji；太阳 + 上升双版。

### CHANI（chani.com）
- 以**上升星座**写内容；导航 Today / This Week / This Year；Today 含每日运势、月相月座、冥想。网页单签页正文约 77 词，第二人称建议 + 反思问题收尾。来源 https://chani.com/signs/aries 、https://www.chani.com/blogs/daily-horoscopes-in-the-chani-app
- 本命盘按行星组织，每颗给「gifts / challenges」两栏；盘面元素可点弹解释。来源 https://sunmoresun.substack.com/p/chani-app-review
- **未知出生时间官方指南**最完整：找时间四步 → 1–2 小时窗口测上升 → Noon Chart（忽略上升、宫位、四轴）或 Sunrise Chart（太阳当上升，即杂志星座写法）。来源 https://chani.com/astro-education/how-can-i-work-with-my-astrology-chart-if-i-dont-know-my-birth-time
- 付费 $11.99/月、$107.99/年，14 天试用。视觉：黑白 + 金、做旧字标、risograph 插画、纸纹。
- 借鉴：「读上升」教育 + 一键排盘；gifts/challenges 结构；三层时间导航；上下文帮助按钮。

### astro.com（Astrodienst）
- 免费工具极多（Chart Drawing、Extended Chart Selection、Personal Daily Horoscope by Robert Hand、AstroClick Portrait 点击盘面出解释）；默认深色模式；首页显示当前行星位置。来源 https://www.astro.com/horoscopes
- Extended Chart Selection：盘风格下拉、宫位制下拉、附加天体多选、tropical/sidereal 多种 ayanamsha；可保存为默认。
- **未知出生时间规则**：选 unknown → 自动 12:00 正午；分钟填 "u" 标记假设时间，盘面显示 "hyp" 且不画宫位。来源 https://www.astro.com/cgi/xa.cgi/faq/fq_de_time_e.htm
- 付费：Astrodienst PLUS 12.90/年（去第三方广告 + 存 2000 条数据）；Extended Daily Horoscope 49.90/年；每周四免费开放付费运势作试用。来源 https://www.astro.com/prod/pr_astroplus_e.htm 、https://www.astro.com/prod/pr_hkonl_e.htm
- 弱点：必须先建 profile；界面老旧；对新手过于专业。

### Cafe Astrology（cafeastrology.com）
- 每日运势单签页顺序（实测 HTML）：H1 星座 → 正文 2 段约 195 词（先行运后月亮）→ 三项文字评级 Creativity / Love / Business（Good / Fair …）→ Yesterday / Today / Tomorrow / Day After Tomorrow → 星座选择器 → 全体当日行运 → 本月 → 本年 → 本年爱情 → 付费报告促销。来源 https://cafeastrology.com/ariesdailyhoroscope.html
- 表单（astro.cafeastrology.com/natal.php）：昵称 + He/She/They；年月日下拉；24 小时制；**「Unknown Time」勾选 → 省略上升与宫位并说明**；城市自动填经纬；「Shareable」勾选；页脚娱乐声明；Profile number + PIN 无账号保存。
- 广告：AdSense（HTML 含 adsbygoogle 槽位）。无社交分享按钮。
- 弱点：单页 184KB、信息密度过高、视觉老旧。

### Astro-Seek（astro-seek.com）——全部二手，站点屏蔽自动访问
- 海量专业计算器（本命、行运、合盘、推运、Hellenistic、Horary、小行星、吠陀 D1–D60、Vimshottari、Ayanamsa 计算器）；URL 参数化的盘可直链；无需注册；全免费。
- 表单含「unknown time」勾选，博客称技术默认 10:00（与行业惯例 noon 不同，未验证）。来源 https://astroseek.org/en/blog/birth-chart-without-birth-time

### A 小结
1. **最佳每日运势结构**：网页端 Cafe Astrology（正文 → 评级 → 日切换 → 全体行运 → 月/年）；App 端 Co-Star（一句箴言 → Do/Don't → 领域三态 → 行运段落 → 反馈）。
2. **结果页平衡**：Co-Star 三行标题卡片 + 一段白话；CHANI gifts/challenges；Cafe 传统顺序（盘轮 → 行星表 → 上升 → 行星星座 → 行星宫位 → 相位）；astro.com AstroClick 点击盘面出解释。综合建议：顶部大三摘要卡 → 左盘轮右行星手风琴（三行标题 + gifts/challenges）→ 盘轮元素点选联动 → 相位表折叠。
3. **未知出生时间**：行业惯例是 noon + 隐藏上升/宫位并明确标注（astro.com、Cafe），CHANI 另给 Sunrise 方案。

## B. 塔罗在线产品

### Labyrinthos（labyrinthos.co）
- Shopify 商店 + 内容站 + App。免费抽牌页：标题与牌位说明 → 广告位 → **选牌组**（5 副自家牌）→ 深紫背景 N 张固定牌背 → 点击原位翻面 → 牌名 + 简短牌义 + Read More → 更多牌阵 → App 下载 → 实体牌商品 → 邮件订阅。来源 https://labyrinthos.co/pages/free-love-tarot-reading
- 网页：无洗牌、无切牌、无挑牌、无逆位、无问题框、无分享。App：50–70 牌阵、日记（免费 100 条）、逆位开关、「Mirror」统计（最常出现的牌/花色/逆位比例）、分享为链接而非截图、12 语言含中文。来源 https://app.labyrinthos.co/home 、https://play.google.com/store/apps/details?id=com.labyrinthos.app
- 付费 Premium $8.99/月（Web）/ $9.99（iOS）。视觉：墨绿 + 米白 + 深紫、衬线 + ✦、金箔极简牌面。

### Golden Thread Tarot
- 已停更，被 Labyrinthos 取代；产品形态遗产：Reading Log + 模式统计 + 牌义数据库。来源 https://apkcombo.com/golden-thread-tarot/com.ionicframework.tarot371308/

### Biddy Tarot（biddytarot.com）
- 78 牌义库 SEO 极强；网站在线工具只剩「Pull a Card」单张：深紫渐变背景，一张牌背点击翻面，显示 "UPRIGHT" 标签 + 本周解读文字；无洗牌/切牌/问题框/分享。来源 https://biddytarot.com/pullacard/
- 会员 Explorer $33/月、Alchemist $97/月。视觉干净 wellness 风。

### tarot.com（实测）
- **最完整的仪式流程**：顶部问题输入框（可选）→ 横向扇形牌背 + 「Shuffle Cards / Stop Shuffle」持续洗牌动画 → 提示 "CHOOSE SELF CARD" → 点扇形中任一张飞到下方牌位翻面 → 依次 "CHOOSE SITUATION CARD" → "ALL CARDS CHOSEN" → 「CHOOSE A DECK」下拉换牌组 → 「REVEAL THE MEANING」→ **注册墙**。来源 https://www.tarot.com/readings-reports/tarot-readings/free
- 付费 Karma Coins（100 币 $12.50 起）。顶部 Google 广告。

### Trusted Tarot（trustedtarot.com，实测）
- 14 种免费牌阵下拉；「Enable reversed cards」勾选（FAQ 建议 5% / 10% / 50% 概率）；78 张牌背 6×13 网格铺开点选、原位翻面；「Shuffle Virtual Tarot Deck」按钮重洗；抽牌前接地冥想音频；卖点「每天真人手洗实体牌」。无注册、靠捐赠。来源 https://www.trustedtarot.com/free-reading/ 、https://www.trustedtarot.com/daily/
- 视觉：1909 RWS 重制牌面、天蓝云朵 + 金色，略老派。

### B 小结：四种交互模式

| 模式 | 代表 | 洗牌 | 切牌 | 挑牌 | 翻牌 | 牌阵选择 |
|---|---|---|---|---|---|---|
| ① 单牌堆点击翻开 | Biddy Pull a Card | 无 | 无 | 无 | 点牌堆翻面 | 固定 1 张 |
| ② 固定位置牌背逐张点开 | Labyrinthos 免费页 | 无 | 无 | 无 | 原位翻面 | 每页固定 |
| ③ 全牌铺开网格任选 | Trusted Tarot | 按钮重洗 | 无 | 78 张点选 | 原位翻面 | 14 种 + 逆位 |
| ④ 问题 → 洗牌动画 → 扇形挑牌 → 落位翻开 | tarot.com | 有动画 | 无 | 扇形点选 | 落位后翻面 | 固定 3 张 |

- **四家都没有做切牌**；洗牌动画只有 tarot.com；问题输入框只有 tarot.com。
- 最佳参考为 tarot.com 的模式④，补齐：切牌、逆位开关（概率可调）、不设注册墙、结果页「牌名 + 关键词 + Read More + 分享链接」、日记与统计（Mirror）。

## C. 吠陀站点

### Prokerala（prokerala.com/astrology）
- 工具单页化（SEO）：Birth Chart、Navamsa（South / North / East Indian 三图式）、Nakshatra Finder、Kundli Matching、Sade-Sati、Mangal Dosh、Panchang、Choghadiya、Hora、KP、Lal Kitab、数字学；多印度语言。来源 https://www.prokerala.com/astrology/ 、https://www.prokerala.com/astrology/birth-chart/navamsa-chart.php
- 表单：Name、Gender、年月日下拉、12 小时制时分 AM/PM 下拉（**必填，无未知选项**）、出生地自动补全。
- 日运按**西方太阳星座**；单签页分 Daily / Health & Wellness / Love & Relationship / Career & Money 四段 + 昨今明 + 周月年。
- 日 Panchang 页字段：Tithi（含 Paksha、时段、月相图标）、Nakshatra（换星时间）、Yoga、Karana、日出日落月出月落、Rahu Kalam、Yamaganda、Gulika、Dur Muhurat、Varjyam、Abhijit、Amrit Kaal、Brahma Muhurat、Samvat、Rashi、节日；位置文本框 + 日期。来源 https://www.prokerala.com/astrology/panchang/
- 付费：邮件 PDF 报告 ₹299–1,500。顶部 Google 广告 + 正文广告；有社交分享图标。

### AstroSage（astrosage.com）
- Kundli 表单：Name、Gender、Day/Month/Year、Hrs/Min/Sec（必填）、Place、「Now / Current Location」快捷、高级设置：经纬度、时区、**Ayanamsa 下拉（N.C.Lahiri / KP New / KP Old / B.V.Raman / KP Khullar / Sayan）**、North / South Indian 图式；KP Horary 1–249。来源 https://www.astrosage.com/kundli/
- 免费结果 50+ 页：Life Predictions、Dasa、Sade Sati、Mangal Dosha、Shadbala、Ashtakvarga、Shodashvarga 16 分盘、KP、Lal Kitab、Tajik Varshaphal、Ashtakoot 配对、PDF/JPG 分享。来源 https://www.astrosage.com/freekundli/
- 日运按**月亮星座**：多段正文 + Lucky Number + Lucky Color + Remedy + 六维五星（Health / Wealth / Family / Love Matters / Occupation / Married Life）。来源 https://www.astrosage.com/horoscope/daily-aries-horoscope.asp
- Panchang 页：Tithi、Nakshatra、Karana、Paksha、Yoga、Vara、日月出没、Moon Sign、Ritu、三种 Samvat、Purnimanta/Amanta 月名、Rahu Kaal 等凶时、Abhijit、Disha Shoola、Tara Bala / Chandra Bala、行星位置表（Rashi / 经度 / Nakshatra / Pada）。来源 https://panchang.astrosage.com/panchang/aajkapanchang
- 付费：Brihat Kundli ₹996、Cloud Gold $31/年、按分钟咨询、宝石电商。几乎无第三方广告，但每屏自家上卖。视觉橙黄、老式门户。

### Drik Panchang（drikpanchang.com）——区域登录墙，二手 + App 描述
- 位置由 geoname-id URL 参数决定，内置 DST。日 Panchang 字段顺序见第一轮报告。App 含 Panchaka、Ganda Moola、Bhadra、Anandadi Yoga、Choghadiya、Hora、Udaya Lagna、倒计时 Muhurta；内购去广告 $9.99/年。来源 https://apps.apple.com/app/id1321271821
- 借鉴：城市 ID + 时区精度、倒计时吉时。

### Astro-Seek Vedic——二手
- D1 + D9 + Shodasha Varga D1–D60、Vimshottari（Lahiri）、Ayanamsa 计算器、North/South 图式、Arudha Lagna、多 ayanamsa 可选。来源 https://horoscopes.astro-seek.com/vedic-indian-hindu-astrology-kundli-calculator

### C 小结：吠陀结果页标准元素
1. Basic Details（含 Ayanamsa）；2. D1 Lagna Chart（北/南切换）；3. Navamsa D9（深度站给 16 分盘）；4. 行星位置表（Rashi、度、Nakshatra、Pada、逆行）；5. Janma Nakshatra + Pada + Chandra Rasi + 名字首音节；6. Vimshottari Dasha 表；7. Doshas（Mangal、Kaal Sarp、Sade Sati）；8. Ashtakavarga / Shadbala（进阶）；9. 出生日 Panchang 块；10. PDF 下载 + JPG 分享。
日 Panchang 标配：Vara、日月出没、Tithi（Paksha + 结束时间）、Nakshatra（换星时间）、Yoga、Karana（两段）、Amanta/Purnimanta 月名、Samvat、Ritu、日月 Rashi、Rahu Kaal / Yamaganda / Gulika / Dur Muhurtam / Varjyam、Abhijit / Amrit Kaal / Brahma Muhurta、节日。
**三家吠陀站都不处理未知出生时间，这是天机的差异化机会。**
