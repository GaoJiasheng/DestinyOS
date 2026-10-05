# 体系规范 · 生命灵数（Numerology）

> B-10 最简项；代码 `numerology`，西方主题；纯函数、离线可算，无运行时 LLM。

## 1. 输入与流派

复用 `NormalizedBirth` 的 **公历 local 年月日**，农历档案先规范化；不使用时辰、性别、真太阳时。
新增可选 `ReadingRequest.name`：英文姓名，最长 120 字符；英文字母和空格、连字符、直/弯撇号，不自动转写中文。
独立入口 `computeNumerology({ birth, name?, date })`；`date` 为显式公历 YYYY-MM-DD。
统一 `compute` 使用显式 `now` 在出生档案时区的日期；每日页使用用户当前时区目标日期。
`meta.schoolUsed`：`alphabet=pythagorean`、`masters=11_22_33`、`lifePathMethod=all_digits`、`yearBoundary=january_1`、`vowels=aeiou`。

## 2. 规则

- 生命灵数：生日年月日所有数字整体相加，继续把总和各位相加归一；遇 11/22/33 停止；其余停在 1–9。不先分段归一年月日。
- 生日数：保留出生日 1–31，另给归一结果；保留 11/22。
- 毕达哥拉斯字母表：A–I=1–9，J–R=1–9，S–Z=1–8；不区分大小写，分隔符忽略。
- 表达数：全部字母；灵魂数：AEIOU；人格数：剩余字母（Y 固定为辅音）。各组保留大师数，无元音/辅音时该组 number=null。
- 个人年：出生月与日的各位和 + 目标年的各位和，归一到 1–9；一月一日切换。
- 个人月：个人年 + 目标月份归一；个人日：个人月 + 目标出日归一。周期不保留大师数。
- 流年周期：目标年开始连续九年，个人年依次循环 1–9。
- 九宫格：统计生日非零数字次数；布局上排 3/6/9、中排 2/5/8、下排 1/4/7。空格不代表缺陷。
- 组合提示：生命灵数基础数与表达数基础数；无姓名用生日基础数；排序 first≤second，45 种无序组合。描述自身主题配合，非伴侣评分。

## 3. 输出（`NumerologyChartSchema`）

`lifePath: { sum, steps[], number }`；归一过程中保留中间总和，不保留生日原始数字序列。
`birthday: { day, number }`。
`nameNumbers: { expression, soul, personality } | null`，各项 `{ sum, steps[], number|null }`；**不输出姓名原文或逐字母序列**。
`personal: { year, month, day, targetDate }`。
`cycles: Array<{ year, number, isCurrent }>`，恰好九项。
`grid: Array<{ digit, count }>`，1–9 恰好九项。
`compatibility: { first, second, basis: birthday|expression }`。
姓名原文仅置于已加密的输入快照/本地加密存储。公开分享只投影生命灵数。
每日 `DailyChart.numerology?: { personalDay }`，新计算总会输出；可选性兼容历史快照。

## 4. 解读章节与知识库

章节：`overview → life_path → birthday → name_numbers → personal_year → rhythms → compatibility → summary_actions → learn`。
125 条 KU：生命灵数 12、生日 31、个人年 9、月/日主题 9、姓名主题 12、组合 45、通用与方法 7。
每条同时提供 zh/en，遵守 05 的字数、禁词、触发路径与建议约束；姓名省略用专用 KU。
百科 `/learn/numerology`；输入 `/numerology/new`；报告 `/numerology/r/[id]`；匿名报告沿用 `/r/local/[id]`。

## 5. 算术核验与验收

以下总和为独立手算，测试固定，不由实现生成；本项无外部排盘库。

| 公历生日 | 总和 → 生命灵数 |
|---|---|
| A 1990-05-15 / B 1985-11-02 / C 2000-02-04 | 30→3 / 27→9 / 8→8 |
| D 1988-07-10 / E 1995-08-20 / G 1960-01-01 | 34→7 / 34→7 / 18→9 |
| 2000-01-08 / 2000-09-29 / 1999-01-04 | 11 / 22 / 33 |
| 2000-02-29 / 1900-01-01 / 2100-12-31 | 15→6 / 12→3 / 10→1 |
| 2001-01-01 / 2002-02-02 / 2003-03-03 / 2004-04-04 | 5 / 8 / 11 / 14→5 |
| 2005-05-05 / 2006-06-06 / 2007-07-07 / 2008-08-08 | 17→8 / 20→2 / 23→5 / 26→8 |
| 2009-09-09 / 1990-01-11 / 1990-01-22 | 29→11 / 22 / 24→6 |

John Doe：表达 35→8，元音 17→8，辅音 18→9。Amy：表达 12→3，元音 1，辅音 11。
Fixture A 在 2026-10-05：个人年 3、月 4、日 9；2027-01-01 年 4。
测试包括 23 个生日黄金用例、26 字母表、农历转换、大师数、闰日、Y、空集合、姓名拒绝、时区跨日、输出隐私、500 个合法生日双语可读性与章节覆盖。
E2E：zh/en 输入→报告→档案自动复用→姓名留空→每日个人日数与百科，桌面/375px。
