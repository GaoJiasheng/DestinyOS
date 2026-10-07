# APP-M15 · 商店素材与提审准备

## 完成项
- 三语 next-intl 商店标题、副标题、长描述、关键词与 Play 简介；导出 JSON 自动检查商店字段长度。
- 6.9 寸、6.5 寸 iPhone：每尺寸/语言六张真实页面原图及品牌模板；原图与 SHA-256 清单可复核。
- 三语素材涵盖真实星空、八字、星盘、塔罗、日历、学习；自动化为 Maestro + 公开 Fixture A。
- 品牌图标、Android adaptive icon、Play feature graphic；模板复用共享设计 token。
- Apple 隐私营养标签 / Google Data safety 草稿，覆盖账号、出生信息、购买、广告 SDK 与诊断。
- 主 App 与 Widget 的 PrivacyInfo.xcprivacy；Expo 配置注入主清单，Widget 单独声明 App Group。
- EAS store/Release/AAB/远程版本递增、生产环境与频道、fingerprint OTA 配置；没有提交密钥。
- 生产缺配置、测试库存与诊断开关会阻止构建；正式广告单元配置，调试包继续使用测试广告。
- RELEASE.md：ASC、Play、RevenueCat、AdMob、地区排除、审核备注、真实测试与发布步骤。

## 未完成项 / Owner 待验
- 按 Owner 指示未安装 Android Java、未进行 Android 原生构建/模拟器验收；Android 三语 18 张截图待补。
- Android Release/摇卦/通知/三尺寸小组件/午夜更新/TalkBack/真实商店购买、广告与登录，安装 Java 后执行。
- 生产 EAS/服务 ID、签名、真实商店沙盒、跨端权益、最终 Archive 隐私报告由 Owner 配置并验收。
- 一周 TestFlight/Play 内测、iPad 素材、内购审核截图、私密演示账号/视频、公开删除说明与支持页待 Owner。
- 不宣称已上传、提审、上架或生产 OTA 生效。

## DESIGN-GAP 列表
- 生产公用服务 ID 由 Owner 后台提供，未配置不生成假生产包；native fingerprint 隔离 OTA。
- 保留 M14 已验证的 Sentry 8 集成，排除 Expo 的 Sentry 7 推荐降级提示。
- 使用仅开发可进入的 Fixture 截图入口，显式开始并等待加密偏好加载，避免语言/旧画面竞态。
- 品牌模板/星盘图标按共享 token 程序绘制；原图整屏等比例放入普通框，不裁剪或伪造平台；生成器拒绝开发刷新浮层。
- Maestro 复用本机已有 JVM，仅用于 iOS 自动化，不安装 Android Java。
- 商店文案新增 mobile.store.* 键；英文名称采用 §12 已建且符合 30 字符限制的名称。

## 如何验证
- 必需检查全部通过：pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build；证据 M15/verification.json。
- 全仓 Vitest 3722 通过（既有 2 跳过）；Jest + RNTL 54 套/254 通过，含 M15 11 项；覆盖 Web 回归。
- iOS、Android expo prebuild --no-install 静态校验；XML 清单与配置 JSON 一致，App Group/包名/小组件检查。
- pnpm i18n:check、pnpm licenses:check、expo install --check；无新增 GPL/AGPL 依赖。
- store:capture <UDID> <iphone-6.9|iphone-6.5> <zh|en|zh-TW>；store:assets 重建模板与来源清单。
- 实际尺寸 1320×2868 / 1242×2688，PNG 无透明；逐张检查界面、语言、字体与调试浮层。
- 原图 apps/mobile/test-results/M15/raw；成品 apps/mobile/store/screenshots；手册 docs/app/RELEASE.md。
