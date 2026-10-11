# privacy_app · 隐私政策与条款 App 补充

## 完成项

- 核对 overview、安全隐私、架构、IOS-STORE 缺口及移动端真实 SDK / 服务端行为。
- privacy 与 terms 新增 iOS / Android App 章节，zh、zh-TW、en 同步，保留既有路由及键。
- 覆盖 SQLCipher / SecureStore、本地离线计算、Apple / Google / 魔法链接、令牌及同步。
- 覆盖本地通知、小组件展示快照、商店购买与 RevenueCat、AdMob / UMP / ATT、Sentry 开关。
- 覆盖 MiniMax 去标识化接收内容、第一方加密对话及举报保留、18+ 和 privacy@gavin.pub。
- 明确 App 内删除与报告导出、网站完整 JSON 导出、七天软删除及商店订阅另行取消。
- 两法律页最后更新日期改为 2026-10-12；未配置联系邮箱时使用公共隐私邮箱。
- privacy-answers 同步修正小组件最多八天快照、MiniMax、会话、删除及导出说明。
- 补齐「麵」的两份 OFL 字体分片及对应清单；重新生成繁体共享词库。
- 法律条款增加段间距；App 章节截图从标题开始，全文截图从页首开始。
- 增加 polish 三语法律页检查：完整 App 文案、日期、占位符、字体预算、横向溢出及 axe。

## 未完成项

- 本次任务范围内无未完成项。
- 未部署、未 push；线上政策及最终签名 Archive 问卷仍需发布时复核。

## DESIGN-GAP

- 默认公开隐私邮箱使用新 next-intl 键 legal.contactEmail，保留部署配置覆盖及法定身份占位。
- 按代码披露原生报告导出与网站完整 JSON 导出的区别，不虚构 App JSON 导出按钮。
- 硬删除遵循实际代码：软删除满七天后每日清理，修正旧文案的「七天内」承诺。
- 三语法律页通过真实 next-intl 路由逐段检查，覆盖首屏以下内容与完整截图。
- 长篇法律列表采用段落间距，改善手机阅读，不扩展 Markdown / HTML 解释能力。

## 如何验证

- pnpm install / i18n:check / lint / typecheck：全部通过。
- pnpm test：3802 项 Web / 共享测试通过（既有 2 项跳过），移动 57 套件 / 273 项通过。
- pnpm build：9 项任务通过，含 Web 与 iOS / Android JS export。
- python3 scripts/font-coverage.py：两字体均覆盖 2355 个繁体 UI / 报告 / 教程字形。
- pnpm exec playwright test --config playwright.polish.config.ts --grep 'App legal pages'：6 项通过。
- 截图更新后再无更新参数重跑通过；字体 ≤350KB、无横向溢出、axe 无严重 / 关键问题。
- polish 使用 375px / 1280px，三语 × privacy / terms，共 24 张 App 章节与全文截图基线。
- 完整截图及 axe 结果在 test-results/polish-runner/；视觉复核后保留截图基线。
