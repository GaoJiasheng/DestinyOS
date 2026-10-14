# NO-MEMBERSHIP

## 完成项

- Web 增加 FEATURE_MEMBERSHIP / NEXT_PUBLIC_FEATURE_MEMBERSHIP；App 增加 EXPO_PUBLIC_FEATURE_MEMBERSHIP，均默认关闭。
- 隐藏会员、付费、恢复购买、去广告及开通入口；Web 付费页面返回首页，App 付费深链返回“我的”。支付回调关闭。
- 登录账户保持免费身份；开放完整历史、全部分享模板、PDF/图片导出、20 个档案及原会员额度，不改写既有购买记录。
- 追加 0007 档案配额迁移，保留已部署迁移；校验免费账户 20 档案、超过 50 条历史及全部导出格式。
- 首版无广告位或占位。RevenueCat 不初始化；iOS/Android 自动链接不包含购买、广告与 ATT 模块。
- 更新 zh / zh-TW / en 文案、隐私政策与条款：目前不提供购买和广告，未来提供时更新政策。
- 更新三语言 App Store 描述、审核备注、实际 SDK 隐私问卷及清单；关闭会员时不要求 IAP 审核截图。
- 核对原有 36 张商店截图，无会员界面；保留合格素材与真实提审状态。
- 最新 production iOS Release 的 Maestro 主流程通过；33 张截图及脱敏产物凭据在 apps/mobile/test-results/NO-MEMBERSHIP/。

## 未完成项 / 待验

- 按 Owner 要求未安装 Java、未做 Android 原生构建或模拟器验收；待 Owner 安装 Java 后验证构建、小组件与主流程。
- 原有正式提审外部门槛（签名 Archive / Privacy Report、iPad、真机、私密审核资料与 TestFlight）仍由 Owner 完成。
- 本任务不部署、不 push；线上政策与最终送审配置需在后续发布时核对。

## DESIGN-GAP

- 服务端与公开构建变量均明确开启才启用会员，避免只有服务端开启的部分发布。
- SQLite 不能读取开关：数据库保留 20 档案硬上限，服务层在同一写入批次校验运行时额度。
- Xcode 增量产物可能残留已移除 Pod 资源：构建脚本归档旧 .app 后重建干净产物。
- Maestro 使用真实 production Release 和正常入口；数字键盘已收起时用标签点击代替重复 hideKeyboard。
- 法律说明中的官方 SDK / 平台专名保留；知识库发布复用预检的 90 秒有界等待。
- 使用残留广告 ID 验证关闭开关；IAP 证明只在会员开启时要求，assets-only 不代表可提审。

## 如何验证

- 已实际运行 pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build，均通过。
- Web：152 个单测文件通过，3810 条通过（2 条既有跳过）；App：58 套、276 条全部通过。
- pnpm i18n:check、fonts:check、perf:budgets、内容审计与 store-check --assets-only 通过。
- Web M5 完整回归 97 项、会员关闭专项 6 项通过；polish 52 项通过（更新合法文案/额度截图后逐项正常复验）。
- pnpm cf:build / pnpm cf:multi:smoke 通过；移动链路 25 项，冷请求 72.4ms，公开 RSC 最大 P75 5.3ms。
- Android：pnpm --filter @tianji/mobile prebuild:android 通过，生成工程及自动链接静态检查通过。
- iOS：Release 模拟器构建、NO-MEMBERSHIP Maestro 全流程通过；确认无购买/广告/ATT Pod、资源包、广告标识与跟踪提示。
