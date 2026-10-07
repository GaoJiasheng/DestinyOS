# 商店隐私申报草稿（M15）

依据 docs/app/00-app-plan.md §7、docs/08 及当前数据流；这是待 Owner 对最终签名二进制和后台配置复核的草稿。不能选择「不收集数据」。设备本地计算不等于启用登录/SDK 后仍不收集数据。下列 linked 是保守申报，SDK 去标识化必须有证据才可调整。

## Apple App Privacy

| Apple 数据类型                                      | 实际数据 / 接收方                                           | 用途                                                                  | 与用户关联                       | 跟踪                             |
| --------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| Contact Info → Email Address                        | Apple/Google/魔法链接登录邮箱，Worker、Resend（发登录邮件） | App Functionality                                                     | 是                               | 否                               |
| Identifiers → User ID                               | 不含邮箱的 User.id；Worker、RevenueCat                      | App Functionality                                                     | 是                               | 否                               |
| Other Data Types                                    | 自愿保存/同步的生日、时间、城市级出生地点、性别、档案标签   | App Functionality                                                     | 是                               | 否                               |
| User Content → Other User Content                   | 同步的报告、日记、反馈；主动发送的追问/举报                 | App Functionality                                                     | 是                               | 否                               |
| Purchases → Purchase History                        | 产品 ID、交易、订阅/退款状态；商店、RevenueCat、Worker      | App Functionality                                                     | 是                               | 否                               |
| Identifiers → Device ID                             | AdMob 设备/广告标识；IDFA 仅 ATT 同意后                     | Third-Party Advertising、Analytics                                    | 是                               | 是（同意后）                     |
| Location → Coarse Location                          | 广告 SDK 从 IP 估计区域，不是 GPS，也不是出生地             | Third-Party Advertising、Analytics                                    | 是                               | 是（同意后）                     |
| Usage Data → Advertising Data / Product Interaction | 广告展示、点击、广告 SDK 交互                               | Third-Party Advertising、Analytics                                    | 是                               | 是（同意后）                     |
| Diagnostics → Crash Data                            | 脱敏技术异常，Sentry；另含 AdMob SDK 崩溃                   | App Functionality、Analytics；广告 SDK 还用于 Third-Party Advertising | 否（Sentry）；SDK 按最终报告复核 | 否（Sentry）；SDK 按最终报告复核 |
| Diagnostics → Performance Data                      | 启动/FPS 数值；广告 SDK 启动/卡顿/能耗                      | App Functionality、Analytics；广告 SDK 还用于 Third-Party Advertising | 是（保守覆盖 SDK）               | 是（SDK 同意后）；最终报告复核   |

出生城市不是「实时精确位置」，出生信息与广告 SDK 完全隔离。没有相机、麦克风录音、通讯录或 GPS 权限；通知排程、小组件、加速度计在设备运行，不单独上报。匿名本地数据不离开设备；登录后确认导入才同步。主动分享和导出会将选定报告发送到自家 Worker；追问文本可能包含用户自行输入的敏感信息，实际 AI 接收方按生产服务核对，不宣称「整个 App 无 AI」。

`../PrivacyInfo.xcprivacy` 为主 App 清单的可审阅副本；`../release/privacy-manifest.json` 由 app.config 的 `ios.privacyManifests` 注入 CNG 工程。`../native/widget/PrivacyInfo.xcprivacy` 单独声明 Widget 的 App Group UserDefaults。第三方 Expo/RN、Google GMA/UMP、RevenueCat、Sentry 自带清单必须保留，主 App 清单不能替 SDK 声明。

Required Reason：CA92.1（App 私有偏好）、1C8F.1（同 App Group 小组件）、C617.1（App 容器文件时间）、35F9.1（时间间隔/启动性能）、E174.1（写入/下载前容量）；不以这些 API 做指纹。当前广告域名为最小已知集合，Owner 必须使用 Organizer 的 Privacy Report 和真实广告请求复核/补齐 SDK tracking domains；主清单不能覆盖 SDK 所有网络域名。

## Google Play Data safety

总问卷：收集/共享数据 = Yes；传输加密 = Yes（TLS）；可以申请删除 = Yes；不勾选独立安全审查认证。支持 Apple、Google OAuth 和邮箱魔法链接，不声称存在密码注册。必须提供无需安装 App 也能发起删除请求的公开网页 URL；现有 `/en/me/settings` 需要登录，不能直接当作公开删除说明页。Owner 发布说明页后填入 Play Console。

| Play 数据类型                                                                | 收集                      | 共享                       | 可选/必需                                    | 用途                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------- | -------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Personal info → Email address / User IDs                                     | 是                        | 否*                        | 可选（登录）                                 | Account management、App functionality                                                        |
| Personal info → Other info                                                   | 是（同步出生信息/档案）   | 否*                        | 可选（同步）                                 | App functionality                                                                            |
| App activity → Other user-generated content                                  | 是（报告/日记/追问/举报） | 否*                        | 可选（同步/追问/导出）                       | App functionality                                                                            |
| Financial info → Purchase history                                            | 是                        | 否*                        | 可选（内购）                                 | App functionality、Account management、Fraud prevention                                      |
| Device or other IDs                                                          | 是                        | 是（广告 SDK）             | AAID 可选；其他 SDK ID 按 SDK 实际行为填写   | Advertising or marketing、Analytics、Fraud prevention/security/compliance                    |
| Location → Approximate location（IP）                                        | 是                        | 是（广告 SDK）             | 必需于广告功能；不能因拒绝个性化就声称不收集 | 同上                                                                                         |
| App activity → App interactions                                              | 是                        | 是（广告 SDK）             | 必需于广告功能                               | 同上                                                                                         |
| App info and performance → Crash logs / Diagnostics / Other performance data | 是                        | 是（广告 SDK）；Sentry 否* | 技术监控/广告 SDK 功能必需                   | Analytics、App functionality、Advertising or marketing、Fraud prevention/security/compliance |

- 仅当供应商按合同作为服务提供商处理、没有独立用途时，才用 Play 的 service-provider sharing exception；Owner 核对 RevenueCat、Sentry、Resend、Cloudflare、AI 提供方合同。广告 SDK 与任何独立用途不能套用此例外。不要选「临时处理」：服务器和 SDK 存储超出请求生命周期。非个性化广告仍可能发送 IP、诊断和 App Set ID；AAID/IDFA 获取依赖平台与同意，不能承诺拒绝 ATT 后零数据。

## 删除、保留与最终核对

1. App：我 → 设置 → 删除账户，按界面输入 DELETE；设备登录会话立即失效；同步/服务端硬删除与保留期限按 docs/06、08，政策写 30 天上限，正常清理 7 天内。
2. 本地匿名数据单独删除；删除账户不会自动取消 Apple/Google 月订阅，告知用户进入系统订阅管理取消。购买恢复/法定记录保留及 RevenueCat 删除需按实际服务流程说明。
3. Owner 对最终 Archive 生成隐私报告；逐项核对清单、SDK 版本、追问接收方、Sentry 原生崩溃、广告 tracking 域名与营养标签。Network/广告检查器确认出生信息、邮箱、追问从未进入广告请求。
4. 有 SDK/用途/同意流改动时更新两家商店表单与清单。广告个性化可撤回，会员免广告；应用不因拒绝 ATT 拒绝服务。

参考（2026-10-07 核对）：[Apple Privacy](https://developer.apple.com/app-store/app-privacy-details/)、[Apple manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)、[Google GMA iOS](https://developers.google.com/admob/ios/privacy/data-disclosure)、[Google GMA Android](https://developers.google.com/admob/android/privacy/play-data-disclosure)、[Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)、[RevenueCat Apple Privacy](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)。
