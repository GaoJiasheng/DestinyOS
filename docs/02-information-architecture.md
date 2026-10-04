# 02 · 信息架构与页面规范

> 所有页面先按 375×812 设计，再放大到 768 / 1024 / 1440。每个页面列出：目的、布局、组件、状态、文案键、埋点。文案键对应 `apps/web/messages/{zh,en}.json`，此处只写 zh 示例，en 在 12 文档与文案文件中。

## 1. 站点地图与路由

```
/[locale]                         首页（星空 Hero + 七体系入口 + 今日一瞥）
/[locale]/today                   每日运势
/[locale]/bazi                    体系落地页（介绍 + 开始推算）
/[locale]/bazi/new                输入（无档案时）/ 直接计算（有档案时跳转结果）
/[locale]/bazi/r/[readingId]      报告页（登录）
/[locale]/bazi/r/local/[localId]  报告页（匿名，客户端渲染本地数据）
/[locale]/ziwei …  同上
/[locale]/iching                  起卦选择（梅花 / 六爻）→ /iching/cast?method=…
/[locale]/qimen                   起局参数 → 结果
/[locale]/tarot                   牌阵选择 → /tarot/reading（仪式流程）→ 结果
/[locale]/astrology, /vedic       同本命类
/[locale]/learn                   百科：/learn/tarot/[card]、/learn/iching/[hexagram]、/learn/glossary/[term]、/learn/[system]（SEO 公共页）
/[locale]/me                      我的（档案摘要、历史、设置入口）
/[locale]/me/birth                出生档案编辑
/[locale]/me/history              报告历史
/[locale]/me/settings             语言、主题、音效、动效、隐私、导出、删除
/[locale]/me/billing              订阅
/[locale]/pricing                 去广告订阅介绍
/[locale]/auth/login              登录
/[locale]/auth/verify             魔法链接落地确认
/[locale]/about, /privacy, /terms, /disclaimer, /contact
/s/[token]                        公开分享页（无 locale 前缀，按分享者语言渲染，可切换）
/admin/*                          后台（见 10）
```

- locale 由中间件处理：无前缀访问按 `Accept-Language` 与 cookie 重定向到 `/zh` 或 `/en`。
- 体系路由前缀 `system` 枚举：`bazi | ziwei | iching | qimen | tarot | astrology | vedic`。

## 2. 全局框架

### 2.1 顶部导航（桌面）/ 底部 Tab（移动）
- 移动端底部 Tab 5 项：今日（`/today`）、推算（打开体系面板）、**中央大按钮「问」**（快速占卜：塔罗单张 / 梅花随机，二选一弹层）、学习（`/learn`）、我（`/me`）。
- 桌面顶部：Logo「天机 DestinyOS」左；中间：今日、八字、紫微、周易、奇门、塔罗、占星、吠陀；右：语言切换、主题切换（自动/东方/西方）、登录头像。
- 导航高亮当前体系主题色（见 03）。

### 2.2 页脚
品牌、七体系链接、学习、关于、隐私、条款、免责声明、**Do Not Sell or Share**、GeoNames/字体/图片署名、语言切换、版权。短版免责声明一行。

### 2.3 全局状态与弹层
- 首次访问：免责声明 + 年龄 18+ 确认弹层（必须点「我知道了」）。
- Cookie/同意：AdSense CMP 负责 EEA/UK/CH/US；其他地区底部一行提示。
- 登录态横幅（匿名用户在报告页顶部）：「登录保存这份报告并解锁每日运势」。
- 全局 Toast；全局错误边界页（星空背景 + 「天机暂时不可泄露…」幽默文案 + 重试）。
- 推演中全屏过场（`<DivinationLoader>`）：最少 1.2s，显示该体系的仪式动效与一句引言；实际计算完成后再等到最小时长结束。

## 3. 页面规范

### 3.1 首页 `/`
**目的**：30 秒内让人想试一次；展示"花哨"。
**布局（移动）**：
1. Hero（100vh）：Three.js 星空（含本地当前天空的真实亮星与行星位置，右下角小字「此刻 · 你所在城市的星空」，匿名则用 UTC 0°）；中央品牌字「天机」（东方衬线大字）+ 「DestinyOS」；一句 slogan「读懂你的时间与星辰」/ "Read your sky. Know your path."；主按钮「开始推算」→ 体系选择面板；次按钮「看今日运势」。滚动提示箭头。
2. 「今日一瞥」卡（有档案）：总评星级 + 今日一句 + 幸运色块；无档案显示「今日天象」：月相 + 流日干支 + 节气。
3. 七体系卡片（横滑 + 两列网格）：每卡有体系符号动效（八字：四柱光柱；紫微：旋转十二宫；周易：六爻生成；奇门：九宫点亮；塔罗：翻牌；占星：转动星盘；吠陀：Nakshatra 星带），标题、一句话定位、「需要出生时间」标记。
4. 「它们是怎么算的」三步说明（排盘 → 对照知识库 → 组成报告），强调不用 AI 瞎编、数据不出站。
5. 分享样例轮播（示例卡片）。
6. 页脚。
**状态**：WebGL 不可用 → 静态 CSS 星空（见 03）；`prefers-reduced-motion` → 无动画。
**埋点**：`home.cta.start`、`home.card.{system}`。

### 3.2 体系选择面板（Sheet）
七体系列表，每项：图标、名称、需要时间/地点标记、预计时长「约 1 分钟」。有档案 → 点击直接计算；无档案 → 进入表单。

### 3.3 出生信息表单 `<BirthForm>`（用于 `/me/birth` 与各体系 `/new`）
**步骤 1 · 日期与时间**
- 切换「公历 / 农历」分段控件。
- 公历：年（下拉或输入，1900–2100）、月、日；农历：年（干支 + 公历年并列显示）、月（含「闰X月」项，仅存在时显示）、日（初一…三十）。
- 时间：小时下拉（**13 档地支时辰 + 精确到分钟可选**）：默认展示「时辰选择器」（早子 00:00–00:59、丑 01–02:59 … 晚子 23:00–23:59），右侧「精确到分钟」切换为 HH:mm 输入；复选「我不知道出生时间」→ 禁用时间并展开说明卡：「八字将缺时柱、紫微暂不可算、占星没有上升与宫位，其他体系不受影响」。
- 真太阳时提示（有地点后）：「将按出生地经度与均时差自动修正 ±N 分钟。可在高级选项关闭。」
**步骤 2 · 地点与性别**
- 城市搜索（自动补全，中英可搜，显示 国家 · 省/州 · 时区）；「找不到？手动输入经纬度与时区」折叠。
- 夏令时提示：若该时刻该时区处于 DST，显示「出生证明上的时间通常已含夏令时，如不确定保持默认」。
- 性别：男 / 女 / 不透露（提示：八字大运顺逆与紫微需要性别；选不透露时按「男」计算并标注，报告显示置信度提示）。
- 显示名（可选，仅自己可见）。
- 高级选项（折叠）：真太阳时开关、早晚子时流派、占星宫位制、紫微闰月处理。
- 提交「排盘」。
**校验**：实时；年龄 < 13 → 阻断页「本服务面向 18 岁以上用户」。
**状态**：加载城市库中、搜索无结果、保存中、保存成功（toast + 跳回）。
**文案键**：`form.birth.*`。

### 3.4 报告页（本命类：bazi / ziwei / astrology / vedic）
**布局**：
1. 顶栏：体系名 + 档案摘要（显示名、生肖/星座、出生年份 — **不显示完整生日**，点击展开才显示）、「专业视图」切换、分享按钮、更多（重命名、删除、重新生成）。
2. **Headline 卡**：一句话人设、三个关键词 chip、五维评分雷达（SVG，带入场动画）、置信度条（有 warning 时显示）。
3. **命盘区**（可折叠，默认展开首屏可见部分）：
   - 八字：四柱表 + 五行环 + 身强弱标尺；
   - 紫微：方格盘（移动端默认缩略，点击全屏）；
   - 占星：轮盘（移动端 320px，可切 3D）+ 行星表折叠；
   - 吠陀：D1/D9 切换 + Nakshatra 卡 + Dasha 轴。
   - 盘面元素可点 → 高亮 + 滚动到相关章节（`chart_ref` 锚点联动）。
4. **章节导航**（粘性横向 chips）：概览、日主……
5. **章节正文**：每章 = 标题 + 结论句（大字）+ 段落（术语虚线下划线）+ 「依据」标签行（点击高亮盘面）+ 「建议」列表 + 「原文与规则」折叠 + 本章 👍👎。
6. 广告位：章节 2 与 3 之间、章节 6 与 7 之间（免费用户），样式为与卡片等宽的「广告」标注容器，不在段落内部。
7. **总结与行动清单** + 完整免责声明。
8. 底部：分享 CTA（生成卡片）、「再算一个体系」推荐（有档案则一键）、反馈。
**专业视图**：切换后显示：完整数据表（八字：藏干/十神/纳音/长生/神煞/空亡全表；紫微：杂曜、十二神；占星：相位表、宫头表；吠陀：行星状态表、Antardasha 全表）、流派与参数面板（`schoolUsed`）、计算中间量（节气时刻、真太阳时修正、JD、ayanamsa）、知识库命中列表（unitId + 权重）。
**状态**：加载骨架；引擎 warning（时辰未知）横幅；报告基于旧档案版本的提示；公开分享已开启的标记；403/404。
**埋点**：`report.view.{system}`、`report.section.expand`、`report.pro_view`、`report.share.click`。

### 3.5 占卜流程页（iching / qimen / tarot）
**周易**：
1. 选择方式卡：梅花（时间 / 报数 / 随机）、六爻（摇卦）。
2. 问题与类别（可跳过）：输入框 + 8 类 chips。
3. 仪式：时间起卦显示农历时刻并「以此刻起卦」；报数：大号数字键盘输入 2–3 个数；随机：「抛掷」按钮；六爻：「摇」按钮 × 6（或「一键摇完」），每次显示三枚铜钱落下与爻的生成。
4. 卦象生成动效：六爻自下而上绘出，动爻闪金光，本卦 → 变卦翻转。
5. 结果页（结构同 3.4 但命盘区为卦象图 + 体用/装卦表）。
**奇门**：起局时刻选择器（默认现在，可改）→ 类别 → 「起局」→ 九宫依次点亮 → 结果。
**塔罗**：牌阵选择（卡片展示牌位布局缩略图与适用问题）→ 问题/类别 → 逆位开关 → 仪式（洗牌 → 切牌（可跳过）→ 展开选牌 → 翻牌）→ 结果（牌阵布局图 + 逐牌 + 关系 + 回应 + 建议）。
**状态**：中途退出确认；网络失败（匿名可本地计算）；重复提交防抖。

### 3.6 每日运势 `/today`
按 systems/daily.md §1 的 13 个区块顺序。顶部日期切换（← 昨天 · 今天 · 明天 →），滑动手势切换。无档案 → 示例态（用虚拟档案渲染，整体模糊叠加「填写出生信息查看你的运势」）。
**埋点**：`daily.view`、`daily.date.switch`、`daily.share`。

### 3.7 学习百科 `/learn/**`
- 体系介绍页：历史、原理、能回答什么问题、术语入门、FAQ（含流派说明）。
- 塔罗 78 牌页：图、关键词、正逆位、象征、相关牌、「抽到这张牌的你」CTA。
- 64 卦页：卦象、原文（折叠）、白话、六爻逐爻、常见问题指引。
- 术语页：glossary 全文。
- 均为 RSC 静态生成（ISR 1 天），可索引，含结构化数据（Article）。

### 3.8 我的 `/me*`
- `/me`：头像/显示名、档案摘要卡（生肖、日主、太阳/月亮/上升、Nakshatra）+ 编辑；最近报告 5 条；订阅状态；快捷入口。
- `/me/history`：按体系筛选、搜索标题、无限滚动；每条：体系图标、标题、时间、关键词；左滑删除。免费用户显示「最近 50 条」提示。
- `/me/settings`：语言、主题（自动/东方/西方）、音效、减少动效、每日默认展开 Panchang、时区（自动检测 + 手选）、数据：导出 JSON、删除账户（危险区）；隐私链接；版本号。
- `/me/billing`：当前计划、Stripe Portal 按钮、权益列表。

### 3.9 分享
- 分享弹层：选模板（3 种：「命盘卡」显示盘面缩略 + 关键词；「金句卡」显示一句话人设 + 星级；「今日卡」显示日期 + 星级 + 幸运指标）、选公开程度（revealLevel 0/1/2，默认 0，解释每级显示什么）、生成 → 预览 PNG → 下载 / 复制链接 / 系统分享（Web Share API）。
- 公开页 `/s/[token]`：按 revealLevel 渲染只读报告，顶部「我也要算」CTA，`noindex`。
- OG 图自动生成。

### 3.10 认证
- `/auth/login`：Google 按钮、邮箱输入 → 「发送登录链接」、说明文字「无需密码」、隐私/条款链接。
- `/auth/verify`：「确认登录」按钮（防扫描器），成功后若有匿名数据 → 导入弹层（显示将导入的档案与 N 份报告，可勾选）。

### 3.11 定价 `/pricing`
两列：免费（全部功能、含广告、历史 50 条）/ 会员（无广告、无限历史、更多分享模板、PDF 导出 P1）；月付 / 年付切换；FAQ；Stripe Checkout 跳转。

### 3.12 法律页
`/privacy`、`/terms`、`/disclaimer`：Markdown 渲染，zh/en，更新日期。

## 4. 组件清单（`apps/web/components`）

| 组件 | 说明 |
|---|---|
| `BirthForm`, `CitySearch`, `HourBranchPicker`, `LunarDatePicker` | 表单 |
| `DivinationLoader` | 过场 |
| `ReportLayout`, `ReportHeadline`, `ScoreRadar`, `SectionNav`, `ReportSection`, `TermChip`, `EvidenceTags`, `AdviceList`, `SourceFold`, `FeedbackBar` | 报告 |
| `BaziPillars`, `ElementRing`, `StrengthGauge`, `LuckTimeline`, `BranchRelationDiagram` | 八字 |
| `ZiweiGrid`, `ZiweiPalace`, `DecadalBar` | 紫微 |
| `HexagramFigure`, `CoinToss`, `NumberPad`, `TrigramBodyUse`, `LiuyaoTable` | 周易 |
| `QimenGrid`, `QimenCompass` | 奇门 |
| `TarotDeck`, `TarotShuffle`, `TarotCut`, `TarotFan`, `TarotCard`, `SpreadLayout` | 塔罗 |
| `NatalWheel`, `NatalWheel3D`, `PlanetTable`, `AspectTable`, `VedicSouthChart`, `VedicNorthChart`, `DashaTimeline`, `NakshatraCard` | 占星 |
| `DailyHeader`, `StarRating`, `LuckyRow`, `DoDontChips`, `MoonPhaseIcon`, `PanchangStrip` | 每日 |
| `StarfieldCanvas`（three）、`StarfieldCSS`（降级） | 星空 |
| `ShareDialog`, `ShareCardPreview` | 分享 |
| `AdSlot` | 广告（含 `data-ad-slot`、尊重 plan 与同意） |
| `LocaleSwitch`, `ThemeSwitch`, `SoundToggle` | 全局 |

## 5. 响应式断点与布局网格

- `sm 640`、`md 768`、`lg 1024`、`xl 1280`。内容最大宽 1120px；报告正文列最大 720px（阅读舒适）；桌面报告页为「左 360px 固定命盘栏 + 右正文」。
- 触控目标 ≥ 44px；底部 Tab 高 64px + safe-area。

## 6. 无障碍

- 所有图形组件有 `aria-label` 与隐藏文本表格替代（命盘的表格版本本来就有）。
- 颜色不作为唯一信息载体（五行颜色旁有文字）。
- 焦点可见；弹层焦点陷阱；Esc 关闭。
- `prefers-reduced-motion`：禁用 Three.js 与大动效，保留淡入。
- 对比度：正文 ≥ 4.5:1（见 03 token）。

## 7. SEO

- 公共页：`/`, `/learn/**`, 体系落地页, `/pricing`, 法律页可索引；hreflang zh/en；sitemap。
- 用户报告与分享页 `noindex`。
- 结构化数据：首页 `WebSite` + `Organization`；百科页 `Article`。
