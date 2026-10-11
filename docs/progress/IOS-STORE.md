# IOS-STORE · App Store 资料

## 完成项

- 阅读 overview、架构、App 方案 §0/2/3/4/7/12、RELEASE、安全隐私、现有政策与 store。
- 独立 next-intl 词库导出 en-US（主语言）、zh-Hans、zh-Hant 的完整字段及字符数。
- 中文名称各 3 候选标注首选；英文固定 DestinyOS: BaZi & Tarot；关键词不重复名称词。
- 公开 FAQ、营销、隐私 URL 三语 HTTP GET 实测，结果记录 url-checks.json。
- production iOS Release 原生构建通过；二进制/bundle 哈希记录 test-results/IOS-STORE/build.json。
- 用正式引导录入虚构成年昵称 Alex 的本地档案；不使用 dev 路由、mock 身份或 Fixture A。
- 三语两尺寸各 6 张（1320×2868、1284×2778）真实截图及鎏金天象模板通过尺寸、来源哈希和 36 图视觉复核。
- privacy-answers 按问卷顺序区分本次关闭 SDK 与正式启用后的答案，包含代码证据。
- review-notes 包含离线体验、登录、内购、AI 边界、免责、4.3 和后台已设 18+。
- 自动脚本检查字符、候选、关键词、文件、尺寸、透明通道、截图哈希与 Release 来源。
- Android production prebuild 通过；未安装 Java，未做 Android 原生构建。

## 未完成项（不可宣称可直接提审）

- 两张真实 IAP 审核截图：缺 RevenueCat production key 和真实审核登录，购买确认不可达。
- 未配置会员页只作为 test-results 诊断证据，不当审核截图；未伪造购买或复用 mock。
- 现有政策仍以 Web 为主，需补 App 存储/会话/SDK/AI/Apple 购买与删除说明。
- 最终 Archive 隐私报告须核对 Name、手工出生坐标、举报与原生诊断等清单差异。
- Owner 私密审核联系人/演示账号、真实沙盒、TestFlight、iPad 图与真机小组件/通知待验。
- Android 原生构建、模拟器/小组件验收待 Owner 安装 Java；本任务不含 Android 商店图。

## DESIGN-GAP

- 商店专用三语 next-intl 词库独立保存，不进入 App/Web bundle，不修改既有文案键。
- 品牌模板保留整屏等比截图，只在外围加金色天象网格，不合成产品功能。
- Maestro 使用既有 JVM；虚构成年昵称 Alex 避免空名字触发既有空态文案，不改 App UI。
- 默认完整校验遇真实 IAP 缺失或提审门槛失败；assets-only 仅验证已交付手机资料。

## 如何验证

- pnpm install：通过。
- pnpm lint / typecheck：通过；新增脚本边界 Vitest 7 条通过。
- pnpm test：3802 个 Web/共享测试通过（2 跳过），移动 Jest 57 套件/273 条通过。
- pnpm build：9 个任务全部通过（Web + iOS/Android JS export）；原生 iOS Release 另通过。
- pnpm --filter @tianji/mobile exec tsx scripts/app-store-assets.mts：导出文案与模板图。
- pnpm exec tsx scripts/store-check.ts --assets-only：已通过：36 图、三语字段、源图/成图哈希。
- pnpm exec tsx scripts/store-check.ts：实测按预期拒绝缺失 IAP 01-membership.png 的包。
- 自动化、原图、构建证明及视觉 QA 在 apps/mobile/test-results/IOS-STORE/。
- 本次只产文件、不登录后台、不 push；docs 只写本摘要，未动 .codex-runs。
