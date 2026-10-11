任务：App Store 上架资料定稿（只产出文件，不登录任何后台）。
阅读：docs/app/00-app-plan.md §7、§12，docs/app/RELEASE.md，apps/mobile/store/，docs/08-security-privacy.md，现有隐私政策页文案。
要做（产出到 apps/mobile/store/app-store/）：
1. 三语言（en-US 主语言、zh-Hans、zh-Hant）的：App 名称（≤30 字符，英文名已定为 "DestinyOS: BaZi & Tarot"，中文请给 3 个候选并标注首选）、副标题（≤30）、宣传文本（≤170）、描述（≤4000，突出 §7 的差异点：七大中西体系、离线排盘引擎、三语、真实星空、无运行时 AI 编造）、关键词（≤100 字符，逗号分隔，不重复名称中的词）、新功能说明、支持 URL（https://tianji.gavin.pub/{locale}/faq 或现有页面）、营销 URL、隐私政策 URL。每项附字符数校验。
2. 截图：6.9 寸（1320×2868）与 6.5 寸（1284×2778）各 6–8 张、三种语言，使用 iOS 模拟器 Release 构建实拍并套品牌模板（鎏金天象风，文案用对应语言，不出现测试数据痕迹与调试横幅）；另出 2 张内购审核截图（会员页 + 购买确认态，1290 宽即可）。放 screenshots/{locale}/{size}/。
3. App 隐私问卷答案：逐项列出数据类型、是否收集、用途、是否关联用户、是否用于跟踪（依据代码实际使用的 SDK：RevenueCat、AdMob+UMP+ATT、Sentry 是否启用、邮件、Google/Apple 登录、本地加密存储），输出 privacy-answers.md，格式按 App Store Connect 问卷的实际题目顺序，方便 Owner 照填。
4. 审核备注 review-notes.md：演示账号说明（若需登录才能体验的功能）、内购说明、AI 生成内容说明、内容免责、4.3 差异化说明；以及年龄分级说明（已在后台设为 18+）。
5. 自动校验脚本 scripts/store-check.ts：检查字符数、截图尺寸、文件齐全。
6. 写 docs/progress/IOS-STORE.md；提交，不 push。
