# 14 · 二期 Backlog

> 一期明确不做、但架构已预留的功能。按优先级排序（Owner 可调）。每项给出一句话范围与架构挂点。

## P1（上线后 1–3 个月）

| # | 功能 | 范围 | 挂点 |
|---|---|---|---|
| B-01 | 多档案 | 一个账户多份 BirthProfile（家人朋友），档案切换器，每份档案独立历史与每日 | `BirthProfile` 已多行；去掉"每用户一份 isCurrent"约束，加 `label` 与 `isDefault`；Reading 已关联 profileId |
| B-02 | 合盘 | 八字合婚（日柱/年柱/五行互补/十神互动）、紫微合盘（命宫夫妻宫互看）、西方 Synastry（行星两两相位 + 对方行星落我宫）、吠陀 Ashtakoot 36 Guna | 新 system `synastry`，输入两份 NormalizedBirth；KU 维度新增 |
| B-03 | 辅助定盘（未知时辰） | 问卷（大致时段 + 若干性格/经历选择）→ 列出 12 时辰候选并给相似度排序 → 用户选一个"试排"并可随时改 | 紫微 `E_REQUIRES_BIRTH_TIME` 前端入口已留；引擎批量算 12 盘 |
| B-04 | 推送 | Web Push（每日运势 8:00 当地时间）、邮件日报/周报订阅 | 需 `PushSubscription` 表、cron 分时区发送；Resend 批量 |
| B-05 | AI 追问大师 | 基于当前报告上下文的对话；提示词只含去 PII 的 chart + report；免费 3 次/天，会员 30 次 | `FEATURE_LLM_CHAT`；复用 `polish` 的隐私边界；需 LLM 供应商选择 |
| B-06 | 运势日历 | 月视图热力图（总评颜色），点日期看当天；年度重要日期（节气、大运交接、流年换、水逆、日月食） | `getDailyRangeAction` 已定义 |
| B-07 | PDF 导出 | 报告导出排版版 PDF（会员） | Playwright/`@react-pdf`；字体内嵌 |
| B-08 | 更多分享模板与动图 | 翻牌 GIF/短视频分享 | 服务端渲染成本评估 |
| B-09 | 繁体中文 zh-TW | OpenCC 转换 + 术语覆盖表 | i18n 已预留 |

## P2（3–6 个月）

| # | 功能 | 范围 | 挂点 |
|---|---|---|---|
| B-10 | 更多体系 | 大六壬、太乙神数、姓名学（五格 + 八字配合）、生命灵数（B-10 最简项已提前实现，见 systems/numerology.md）、卢恩符文、玛雅历（Tzolk'in）、面相手相（需图像识别，最复杂） | `System` 枚举扩展；每体系一份 systems/*.md |
| B-11 | 奇门扩展 | 飞盘、置润法、年/月/日家奇门、终身局 | `school.layout`/`juMethod` 已预留 |
| B-12 | 占星扩展 | 推运（二次推运、太阳弧）、返照盘、行运报告（月/年）、Draconic、Harmonics | 星历引擎复用 |
| B-13 | 吠陀扩展 | Shodashvarga 16 分盘、Ashtakavarga、Shadbala、Yogini Dasha、Sade Sati、Mangal Dosha、KP | 自研工作量大 |
| B-14 | 紫微扩展 | 飞星派、四化派别切换、流月/流日盘 | iztro 支持 |
| B-15 | 八字扩展 | 盲派、合化、更多神煞、大运流年详批长文 | `strengthMethod` 版本化已预留 |
| B-16 | 日记与自我追踪 | 用户记录当日心情/事件，与运势对照；长期"准不准"统计（参考 Labyrinthos Mirror） | 新表 `JournalEntry`（加密） |
| B-17 | 社交 | 加好友看对方每日（需对方同意）、公开人格页 | 隐私评估后再做 |
| B-18 | 微信生态 | 微信登录、小程序、微信支付 | 大陆合规风险评估先行 |
| B-19 | 原生 App | Capacitor 或 Expo 包壳；推送与分享更顺 | PWA 先行 |
| B-20 | LLM 润色开关启用 | `FEATURE_LLM_POLISH` 真实实现 | 05 §12 |
| B-21 | 后台评分规则调参 | 每日评分规则表移到 SiteConfig 可编辑 | daily 评分规则已数据驱动 |
| B-22 | A/B 实验与埋点平台 | 自建或 PostHog（需 CMP 接入） | 08 §6.4 提示：第二个追踪脚本需迁通用 CMP |

## 明确不做（除非 Owner 改主意）

- 真人大师咨询市场、按分钟计费聊天。
- 售卖实物（水晶、符咒）或"化解"服务。
- 用户间私信与评论社区。
- 面向 13 岁以下的任何功能。
