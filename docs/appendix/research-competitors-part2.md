
---

# 竞品调研补充（第二轮）：每日运势 / 本命盘结果页 / 塔罗抽牌交互

调研日期：2026-10-04。方法：每个产品实际访问 1–2 个页面（WebFetch，JS 页面走 r.jina.ai 代理），只记录页面上确实出现的内容；无法打开的页面明确标注「未核实」。

## Q1 做得最好的「每日运势」页面长什么样

### 1.1 Cafe Astrology（Aries Daily Horoscope）
来源：https://cafeastrology.com/ariesdailyhoroscope.html
- 板块顺序：① 标题 + 星座符号 → ② 当日日期 + 主运势正文（约 250 词，1 大段，讲 Saturn 行运与 Moon 走位）→ ③ 正文末尾三项文字评级 `Creativity: Good ~ Love: Fair ~ Business: Good`（三档形容词，非星级）→ ④ 日期切换链接：Yesterday / Today / Tomorrow / Day After Tomorrow，以及 Monthly / Yearly / Love 链接 → ⑤ 12 星座切换菜单 → ⑥ 星座日期范围 → ⑦ 「Horoscope for All」全体通用天象解读（约 400 词，含月相）→ ⑧ This Month（约 700 词）→ ⑨ This Year（约 400 词）→ ⑩ This Year in Love（约 200 词）→ 侧栏付费报告推广。
- 没有幸运色/幸运数字，没有心情/爱情/事业/财运分栏；靠「天象解释 + 三档评级」支撑专业感。一页纵向承载日/月/年，长文党风格。

### 1.2 Horoscope.com（Aries Daily）
来源：https://www.horoscope.com/us/horoscopes/general/horoscope-general-daily-today.aspx?sign=1
- 板块顺序：① Daily 主正文（仅约 90 词，1 段，口语化场景式）+ Yesterday / Today / Tomorrow 三个 tab → ② More Horoscopes for Aries（Love / Career / Money / Health / Chinese / Tarot / Numerology 等运势类型入口）→ ③ 星座特质与配对（12 星座配对列表）→ ④ Today's Matches（Love / Friendship / Career 三类今日匹配星座）→ ⑤ Today's Readings for You（付费报告入口）→ ⑥ Today's Star Ratings：5 项五星评分（general mood / sex / hustle / vibe / success，即心情/性/奋斗/氛围/成功）→ ⑦ Today's Advice → ⑧ Daily Planetary Overview（整体星象，带 3/5 评分）→ ⑨ Card of the Day（当日塔罗牌，如 The Empress）→ ⑩ Quote of the Day → ⑪ Ruling for You。
- 特点：正文极短，用大量「模块化小卡片」（星级、匹配、塔罗牌、名言）撑起页面并分流到其他产品；没有幸运色/数字。

### 1.3 AstroSage（Aries Daily，吠陀系）
来源：https://www.astrosage.com/horoscope/daily-aries-horoscope.asp
- 板块顺序：① 12 星座符号选择条 → ② 标题 + 日期 → ③ 主正文（约 180–200 词，1 段，覆盖健康、财务、关系、配偶、母亲等多个生活面）→ ④ Lucky 区块：Lucky Number（3）、Lucky Color（Saffron and Yellow）、Remedy（如「周四避免吃香蕉」，吠陀特有的化解建议）→ ⑤ Today's Rating：五星评分，维度为 Health / Wealth / Family / Love Matters / Occupation / Married Life → ⑥ 咨询占星师 CTA → ⑦ 星座科普长文（性格、职业、健康、宫位、配对）→ ⑧ Weekly / Monthly / Yearly 入口。
- 主内容区未见 Yesterday/Tomorrow 切换 tab。
- 特点：是三家中唯一同时具备「幸运数字 + 幸运色 + 化解/宜忌（Remedy）+ 多维星级」的；和中文产品的「宜忌、幸运色、幸运数字」最接近。

### 1.4 Astro-Seek daily（未核实）
来源尝试：https://horoscopes.astro-seek.com/daily-horoscope-aries → 直连 403，jina 代理 404。本轮未能核实，不作结论。

### Q1 小结
- 三家共同点：主正文置顶、日期切换、12 星座切换、评分（文字三档或五星）、向月/年运势和付费报告分流。
- 正文长度两极：Cafe Astrology ~250 词长文 vs Horoscope.com ~90 词；AstroSage 居中 ~180 词。
- 「幸运色/数字/宜忌」只出现在吠陀系 AstroSage；西方两家不做。
- 评分维度最多的是 AstroSage（6 项）和 Horoscope.com（5 项）；Cafe Astrology 仅 3 项且为文字档。

## Q2 「八字 / 本命盘结果页」如何平衡专业排盘图与通俗解读

### 2.1 Cafe Astrology — Free Natal Chart Report
来源：https://cafeastrology.com/free-natal-chart-report.html ；https://astro.cafeastrology.com/natal.php
- 表单字段：Name（可用昵称）、生日、出生时间（含 Time Unknown 勾选）、出生城市（数据库下拉）、时区（自动填充，有 Time Zone Not Sure 调整项）、UTC offset、Shareable（生成公开链接）。
- 页面自述输出内容：「列出 planet signs, house positions, and aspects」+ 解读；解读目前覆盖主要因子（Sun / Moon / Ascendant / Mercury / Venus 在星座与宫位），作者注明仍在扩充。时辰未知时不输出 Moon / ASC / MC / Vertex / Part of Fortune 及任何宫位。
- 提供多套宫位制平行版本（Whole Sign / Koch / Equal / Porphyry / Alcabitius），以及一个「只出盘图 + 行星位置、不带解读」的独立工具（https://cafeastrology.com/shop/birth-chart-calculator/）。
- 结果数据存库并以 profile 编号保留，可随时回看；另有「Understanding the Free Natal Chart Report」说明文。
- 页面没有描述可折叠、评分或关键词；信息层级是「数据表 → 逐因子解读」的线性长文。
- 未能加载实际结果页本身（403），结果页排版细节（盘图位置）未核实。

### 2.2 Astro-Seek — Birth Chart 页
来源：https://horoscopes.astro-seek.com/birth-chart-horoscope-online （结果页直连 403 / 代理只返回 SVG，未能看到解读正文）
- 表单：日期、时分秒（含「unknown time」勾选）、城市自动补全或手填经纬度、时区与夏令时。
- 「Extended settings」可折叠面板：宫位制、是否显示 Fortune / Vertex / Chiron / Lilith / 南北交点、彩虹色黄道、相位容许度、小相位（150°/30°/45°/135°/72°/144°）、赤纬平行、tropical/sidereal 切换。
- 页面下方展示当前行星位置表（行星图标 + 星座符号 + 度分 + 逆行 R 标记）与月相。
- 结论：Astro-Seek 的策略是「专业参数全部折叠在 Extended settings 里，默认表单极简」；解读章节排布本轮未核实。

### 2.3 astro.com（未核实）
来源尝试：https://www.astro.com/horoscopes/free-horoscopes/personal-portrait 、https://www.astro.com/samples/sp_ap_e.htm（样例）→ 均被「Checking your browser」拦截。只核实到：Personal Portrait 有免费版与付费版两档，并有公开样例页 sp_ap_e.htm 可供人工查看。结构不作结论。

### 2.4 问真八字排盘宝（App Store，中国区）
来源：https://apps.apple.com/cn/app/id1665624645 ；搜索结果 https://apps.apple.com/app/id6753684715
- 开发者：广州问真文化传播有限公司（字在工坊）。注意：该 App Store 条目的描述文案实际是其「五运六气」工具的文案（岁运/司天/在泉/主运/客运/主气/客气/客主加临、年度五运六气可视化并标注当前时间进度、词条弹窗给古籍原文 + 白话解释、自定义交运日为大寒或立春）。
- 用户评论中提到的八字相关界面：「基本排盘」界面带「智能古籍参考」；「专业细盘」界面用于看流年；神煞功能「比较专业和便捷」。
- 搜索摘要显示的定位：多维时间分析（大运、流年、流月、流日）+ 周易 64 卦，另有付费会员（季/年/永久）。
- 可借鉴的点（页面文本明确写出）：**点击术语弹窗 → 古籍原文 + 白话解释** 这一术语解释模式；**基本盘 / 专业细盘两层界面**的信息分级。

### 2.5 灵机八字（App Store）
来源：https://apps.apple.com/cn/app/id1439304528
- 开发者为南阳清伪网络（非灵机文化本体，疑似挂名）。描述只列功能清单：个人运程（今日/明日/本周/本月运势详解）、周易占卜、生肖运程、称骨、前世姻缘、择吉通胜。无结果页结构信息。灵机文化官网 https://www.linghit.com/ 仅公司介绍，无八字精批落地页链接。

### Q2 小结（基于已核实部分）
- 西方工具共性：表单先行，「时辰未知」是一等公民选项；专业参数（宫位制、小天体、容许度）折叠；输出先给数据表（行星/星座/度数/逆行），再给逐因子解读；解读按「行星在星座 / 行星在宫位 / 相位」因子切分，没有总分或关键词。
- 中文排盘 App 的差异化：术语点击弹窗（古籍 + 白话）、基本盘 / 细盘双层、流年流月流日的时间轴扩展、付费精批入口。

## Q3 塔罗在线抽牌的交互模式分类

### 3.1 Trusted Tarot（Free Reading）
来源：https://www.trustedtarot.com/free-reading/ ；https://www.trustedtarot.com/
- 牌阵选择：14 种。1 张：Yes or No、Daily Reading；3 张：Past Present Future、Love and Relationships、Background Problem Solution、Issue Action Event、Money and Career、Quick Reading；6 张：Universal Spread；10 张：Celtic Cross（Classic / New）。
- 洗牌：两个按钮「Shuffle Virtual Tarot Deck」「Shuffle Again」；首页强调「每天真人手工洗一副实体牌并把顺序录入网站」作为随机性的卖点。
- 选牌：78 张牌背以网格铺开，提示「Click on the cards for your reading!」，用户按牌阵所需张数逐张点选，选牌顺序决定牌位。
- 正逆位：可选开关 + 逆位概率可配置（5% / 10% / 50%）。
- 问题输入框：页面未见。
- 抽牌前仪式：提供「接地冥想」音频或文字引导。
- 结果：按牌位解读（「每张牌根据其位置和含义解读」），页面未详述翻牌动画。

### 3.2 Labyrinthos（Free Online Tarot Readings / One Card Tarot）
来源：https://labyrinthos.co/pages/free-online-tarot-readings ；https://labyrinthos.co/pages/one-card-tarot
- 牌阵入口页列 5 种：Yes No、Free Love Tarot、One Card、5 Card Relationship、Money Tarot Spread。每种是独立页面。
- One Card 页定位为「A Daily Tarot Meditation」（每日一牌）；先选牌组（Golden Thread / Luminous Spirit / Seventh Sphere / Arcana Iris Sacra / Tarot of the Velvet Moon，各显示牌背 + 简介），再点「Get Tarot Reading」一键出牌，另有「Read Full Description」展开全文。
- 无问题输入框、无逆位选项、无洗牌/切牌步骤（页面文本中未出现）。
- 每页底部统一推 Labyrinthos Academy App（iOS/Android），强调「更详细的牌阵和学习内容」。
- 模式：**极简一键 + 牌组皮肤选择 + 学习型 App 分流**。

### 3.3 Tarot.com（Daily Reflection / Free Celtic Cross）
来源：https://www.tarot.com/tarot ；https://www.tarot.com/readings-reports/tarot-readings/daily-reflection
- 「每日」产品是 5 张牌的 Daily Reflection，牌位：Situation / Challenges-Opportunities / Advice / Daily Lesson / Near Future；页面有「Shuffle Cards」按钮，每个牌位有对应的选牌区域。
- 其他免费入口：Free Tarot Reading（Celtic Cross）、Yes or No。
- 页面未说明逆位、问题输入、牌组选择；free 与 credits 的边界页面未写明。
- 模式：**先洗牌、再按牌位逐一放牌**的「牌阵优先」流程。

### 3.4 Golden Thread Tarot（App 官网）
来源：https://www.goldenthreadtarot.com/
- 官网只写：Guided Readings（引导式解读）、保存每次解读与每日一牌形成个人情绪数据库、起源于「每天早上抽一张随机牌」。具体洗牌/切牌/翻牌交互官网未描述。
- 模式亮点：**每日一牌 + 日志化记录**。

### 3.5 Biddy Tarot（未核实）
https://www.biddytarot.com/tarot-card-meanings/free-tarot-reading/ 与 /free-tarot-reading/ 均 404；首页只有 Learn / Read / Business 三入口，未见在线抽牌工具。

### Q3 交互模式分类表
| 模式 | 代表 | 洗牌 | 切牌 | 选牌/翻牌 | 牌阵选择 | 正逆位 | 问题框 | 每日一牌 |
|---|---|---|---|---|---|---|---|---|
| 全手动「拟真」 | Trusted Tarot | 按钮洗牌 + 可再洗 | 无 | 网格牌背逐张点选 | 14 种，先选 | 可开关 + 概率 5/10/50% | 无 | 作为 1 张牌阵之一 |
| 牌位引导式 | Tarot.com Daily Reflection | Shuffle 按钮 | 无 | 按 5 个牌位逐一放 | 固定牌阵/多个独立页 | 未见 | 无 | 5 张「每日反思」 |
| 一键极简 | Labyrinthos One Card | 无 | 无 | 一键出牌 | 独立页面各 1 种 | 无 | 无 | 单张「每日冥想」+ 选牌组 |
| 日志型 App | Golden Thread | 未知 | 未知 | 未知 | Guided readings | 未知 | 未知 | 每日一牌 + 保存记录 |

## 对天机的设计建议
1. 每日运势页采用「AstroSage 信息密度 + Horoscope.com 模块化」：顶部日期 tab（昨/今/明）+ 180 词左右的主正文（比 Cafe 短、比 Horoscope.com 实）；紧接一个「今日要素卡」：幸运色、幸运数字、宜/忌各 2 条（对应吠陀 Remedy，但用中文宜忌表述）；再给 4–6 维五星评分（心情 / 爱情 / 事业 / 财运 / 健康，可加「人际」），每维一句话；最后用「今日一牌」「今日一卦」小卡片把塔罗/易经分流进来（Horoscope.com 的 Card of the Day 模式）。月运、年运放次级 tab 而非同页纵向堆叠（Cafe 的 2000 词单页在移动端太重）。
2. 八字 / 本命盘结果页做三层：第一层「一句话画像 + 3–5 个关键词 + 五行/十神雷达」（竞品普遍缺失，是差异点）；第二层默认折叠的「专业排盘图」（四柱 + 藏干 + 十神 + 大运流年时间轴，西方盘则是轮盘 + 行星表 + 相位表），借鉴 Astro-Seek 把宫位制/容许度/神煞等高级参数塞进「高级设置」折叠面板，以及问真「基本盘 / 专业细盘」双层切换；第三层解读按章（性格 / 事业财运 / 感情 / 健康 / 当下大运）每章 150–250 字，每章顶部一句摘要。所有术语做「点击弹窗：古籍原文 + 白话」（问真模式），英文版弹窗给术语的英文释义。时辰未知沿用第一轮结论：显式勾选，并在结果页标注缺失项（Cafe 的做法）。
3. 塔罗：提供两条路径。「每日一牌」走 Labyrinthos 一键极简（选牌背皮肤 → 一键翻牌 → 关键词 + 正/逆位含义 + 一句今日提示 + 保存到日志，参考 Golden Thread）；「正式占卜」走 Trusted Tarot 全手动拟真（可选问题输入框 → 选牌阵（先给 1/3/5/10 张四档）→ 洗牌动画 + 可选切牌 → 牌背扇形/网格逐张点选 → 逐张翻牌 → 按牌位解读 + 总结）。正逆位做成开关并给 0/10/50% 三档，默认关闭以降低新手挫败。问题输入框是四家竞品都没做的空位，可作为中文用户熟悉的「心中默念问题」仪式的落地点，并把问题带入 AI 解读提示词中。
4. 评分统一用五星（Horoscope.com、AstroSage 两家均如此），不要用 Cafe 的 Good/Fair 文字档——五星更适合双语和图形化。

## 未核实项清单（供下轮或人工补查）
- Astro-Seek daily horoscope 页面（403/404）。
- astro.com Personal Portrait 免费版章节结构（浏览器校验拦截，样例 https://www.astro.com/samples/sp_ap_e.htm 需人工打开）。
- Cafe Astrology / Astro-Seek 的实际结果页排版（盘图与表格的先后、是否可折叠）。
- 测测 cece、灵机文化八字精批落地页、Biddy Tarot 在线抽牌（本轮未找到可访问页面）。
