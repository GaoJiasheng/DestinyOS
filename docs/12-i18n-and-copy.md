# 12 · 国际化与文案规范

## 1. 机制
- next-intl，路由前缀 `/zh`、`/en`；默认 `zh`；`Accept-Language` 首访重定向；cookie `NEXT_LOCALE` 记忆；登录用户以 `User.locale` 为准。
- 文案文件 `apps/web/messages/zh.json`、`en.json`，命名空间：`common`, `nav`, `home`, `form`, `report`, `daily`, `tarot`, `iching`, `qimen`, `astrology`, `vedic`, `bazi`, `ziwei`, `me`, `auth`, `pricing`, `legal`, `errors`, `admin`。
- 引擎枚举 → 显示名：`messages/{locale}/glossary.json` 由 `packages/content/glossary` 编译生成，**不要手写**。
- 日期与数字：`Intl` 按 locale；中文日期「2026年10月4日 星期日」，英文 "Sunday, October 4, 2026"；农历与干支始终中文字 + 拼音（en 下显示 "庚午 (Gēng Wǔ)"）。
- 复数与变量：使用 ICU MessageFormat。
- 预留 `zh-TW`（繁体，通过 OpenCC 从 zh 转换 + 术语表覆盖）与 `ja`。

## 2. 语气

| | zh | en |
|---|---|---|
| 人称 | 「你」 | "you" |
| 语气 | 温和、笃定、不卖弄；像懂行的朋友 | warm, grounded, plain-spoken; no mystical fluff |
| 禁用 | 恐吓、绝对化、营销腔（「震惊」「必看」）、网络梗 | doom language, "destined", clickbait, orientalist clichés ("ancient Chinese secret") |
| 术语 | 首次出现加白话括注 | first mention: Term (中文, pīnyīn — gloss) |
| 标点 | 全角标点；数字用半角阿拉伯数字 | serial comma; sentence case for headings |

## 3. 关键文案（zh / en）

| 键 | zh | en |
|---|---|---|
| `brand.tagline` | 读懂你的时间与星辰 | Read your sky. Know your path. |
| `home.cta.start` | 开始推算 | Start a reading |
| `home.cta.today` | 看今日运势 | Today's forecast |
| `form.birth.calendar.gregorian` | 公历 | Gregorian |
| `form.birth.calendar.lunar` | 农历 | Lunar |
| `form.birth.timeUnknown` | 我不知道出生时间 | I don't know my birth time |
| `form.birth.timeUnknown.help` | 没关系。八字会少一柱，紫微斗数暂时算不了，占星会没有上升星座和宫位；其他体系不受影响。 | That's okay. BaZi will miss one pillar, Zi Wei can't be charted yet, and astrology will have no rising sign or houses. Everything else works. |
| `form.birth.solarTime.note` | 已按出生地经度与均时差修正 {minutes} 分钟（真太阳时） | Adjusted {minutes} min for longitude and the equation of time (apparent solar time) |
| `form.birth.dst.note` | 这个时间处于夏令时。出生证明上的时间通常已经包含夏令时，如不确定请保持默认。 | This time falls in daylight saving. Birth records usually already include DST — keep the default unless you know otherwise. |
| `form.birth.gender.unspecified.note` | 八字的大运方向和紫微斗数需要性别。选择"不透露"时将按男性规则计算并在报告中标注。 | BaZi luck direction and Zi Wei need a gender. With "prefer not to say" we calculate using the male rule and note it in the report. |
| `loader.bazi` | 正在排四柱、定喜用…… | Setting the Four Pillars, weighing the elements… |
| `loader.tarot` | 牌已洗好。深呼吸。 | The deck is shuffled. Take a breath. |
| `report.proView` | 专业视图 | Technical view |
| `report.evidence` | 依据 | Based on |
| `report.confidence.low` | 缺少出生时间，这部分只是一个方向。 | Without a birth time, treat this section as directional. |
| `report.disclaimer.short` | 仅供娱乐与参考，不构成专业建议。 | For entertainment and reflection only. Not professional advice. |
| `daily.oneLiner.label` | 今日一句 | Today in one line |
| `daily.lucky.color` | 幸运色 | Lucky color |
| `daily.lucky.number` | 幸运数字 | Lucky number |
| `daily.lucky.direction` | 吉利方位 | Lucky direction |
| `daily.lucky.hours` | 今日吉时 | Good hours |
| `daily.lucky.ally` | 贵人生肖 | Ally sign |
| `daily.do` | 宜 | Do |
| `daily.dont` | 忌 | Don't |
| `auth.magic.sent` | 登录链接已发送到 {email}，15 分钟内有效。 | We sent a sign-in link to {email}. It expires in 15 minutes. |
| `auth.verify.confirm` | 确认登录 | Confirm sign-in |
| `anon.banner` | 登录保存这份报告，并解锁每日运势 | Sign in to save this reading and unlock your daily forecast |
| `anon.import.title` | 把这台设备上的 {count} 份报告导入账户？ | Import {count} readings from this device into your account? |
| `share.reveal.0` | 只显示结论与年份 | Conclusions and birth year only |
| `share.reveal.1` | 显示命盘 | Include the chart |
| `share.reveal.2` | 显示完整报告 | Full report |
| `errors.E_AGE_RESTRICTED` | 本服务面向 18 岁及以上用户。 | This service is for users aged 18 and over. |
| `errors.E_REQUIRES_BIRTH_TIME` | 紫微斗数需要出生时辰才能排盘。 | Zi Wei Dou Shu needs a birth time to chart. |
| `errors.generic` | 天机暂时不可泄露，请稍后再试。 | The heavens are quiet for a moment. Please try again. |
| `me.delete.confirm` | 输入 DELETE 以确认永久删除账户及全部数据 | Type DELETE to permanently remove your account and all data |
| `pricing.pro.title` | 天机会员 | DestinyOS Pro |
| `pricing.pro.benefit.noAds` | 全站无广告 | No ads anywhere |

## 4. 术语翻译规范（节选，全表见 appendix/glossary.md）

| zh | en 展示 | 说明 |
|---|---|---|
| 八字 / 四柱 | BaZi (Four Pillars) | 不译 "Eight Characters" 作主名 |
| 日主 | Day Master | |
| 十神 | Ten Gods | 各项：Friend（比肩）、Rob Wealth（劫财）、Eating God（食神）、Hurting Officer（伤官）、Indirect Wealth（偏财）、Direct Wealth（正财）、Seven Killings（七杀）、Direct Officer（正官）、Indirect Resource（偏印）、Direct Resource（正印）——采用英文八字圈通行译法 |
| 大运 / 流年 | Luck Pillar (10-year cycle) / Annual Pillar | |
| 紫微斗数 | Zi Wei Dou Shu (Purple Star Astrology) | 括注一次 |
| 命宫 / 身宫 | Life Palace / Body Palace | |
| 四化：禄权科忌 | Prosperity / Power / Fame / Obstacle transformations | |
| 梅花易数 | Mei Hua Yi Shu (Plum Blossom Numerology) | |
| 体 / 用 | Self trigram / Subject trigram | |
| 六爻 | Liu Yao (Six Lines) | |
| 奇门遁甲 | Qi Men Dun Jia | 不译 |
| 值符 / 值使 | Chief Star / Chief Gate | |
| 八门 | Eight Gates：Rest（休）、Life（生）、Harm（伤）、Delusion（杜）、Scenery（景）、Death（死）、Fear（惊）、Open（开） | |
| 真太阳时 | apparent solar time | |
| 宜 / 忌 | Do / Don't（每日）；Auspicious / Inauspicious（黄历语境） | |

## 5. 质量
- CI：`i18n:check` 比对 zh/en 键完整性与 ICU 语法；缺键失败。
- 英文文案由英语母语水平审校一次（Owner 或模型）；禁止机翻腔（检查清单：被动语态过多、"the said"、直译成语）。
- 中文：简体；台湾/香港用户可读，避免大陆网络用语。

## B-10 · 生命灵数文案键

`nav.numerology`：生命灵数 / Numerology；`numerology.*` 包含输入、姓名校验、五个数字名、九宫格与周期说明；`daily.personalDay`：今日个人日数：{number} / Today’s personal day number: {number}。全部 zh/en 同时提供，复用 next-intl。
