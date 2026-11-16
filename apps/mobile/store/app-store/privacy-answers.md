# App Store 隐私问卷 · 首版无会员与广告

更新：2026-10-14；2026-11-16 已按本文在 App Store Connect 填写并发布（8 类：姓名、邮箱、精确位置、粗略位置、客户支持、其他用户内容、用户 ID、其他数据；均为 App 功能、与身份关联、不用于追踪）。构建 4 未配置 Sentry DSN，诊断类未申报。仅适用于 FEATURE_MEMBERSHIP 与 EXPO_PUBLIC_FEATURE_MEMBERSHIP 关闭的首版。支付、广告和跟踪授权模块不链接；不请求广告同意或跟踪授权。未来启用时重新审计 SDK、问卷与政策。

按 [Apple 数据收集定义](https://developer.apple.com/app-store/app-privacy-details/) 填写：仅设备上处理的数据无需申报；上传后加密保存的数据仍需申报。

## 1. 是否收集数据

Yes。可选登录、同步、AI 追问与举报会上传并保留第一方账号或用户内容。不能因支持离线匿名使用而填 No。

## 2. 数据类型

| ASC 类型                               | 首版答案                | 实际数据与用途                                                                                                    |
| -------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Contact Info → Name                    | Yes，条件               | 档案名称/昵称可同步；与网站同账号已有显示名。Google profile scope 不代表 SDK 已上传姓名属性                       |
| Contact Info → Email Address           | Yes，条件               | Apple 隐藏邮箱或正常邮箱、Google/魔法链接邮箱，第一方账号与邮件投递                                               |
| Contact Info → Phone Number            | No                      | 不要求电话                                                                                                        |
| Contact Info → Physical Address        | No                      | 无住址字段；出生城市不作为邮寄地址                                                                                |
| Contact Info → Other User Contact Info | No                      | 无其他联系字段                                                                                                    |
| Health & Fitness → Health              | No                      | 不使用 HealthKit，不收集健康表单                                                                                  |
| Health & Fitness → Fitness             | No                      | 摇卦加速度仅本地，不上传运动记录                                                                                  |
| Financial Info → Payment Info          | No                      | 首版不提供付款、购买或广告，也不采集相关数据。                                                                    |
| Financial Info → Credit Info           | No                      | 无信用数据                                                                                                        |
| Financial Info → Other Financial Info  | No                      | 首版不提供付款、购买或广告，也不采集相关数据。                                                                    |
| Location → Precise Location            | Yes，条件               | **保守申报**：手工出生地经纬度允许 ≥3 位小数并可同步；历史出生位置，不是 GPS/当前实时定位                         |
| Location → Coarse Location             | Yes，条件               | 同步的城市级历史出生地，用于排盘，不用于跟踪。                                                                    |
| Sensitive Info                         | No                      | 不请求宗教、种族、性取向、遗传/生物识别等；生理性别/生日归 Other Data Types；自由文本不按所有可能敏感内容额外勾选 |
| Contacts                               | No                      | 不读取通讯录；合盘从本地档案选择                                                                                  |
| User Content → Emails or Text Messages | No                      | 无用户间聊天、收件箱读取；魔法链接是投递功能，AI 对话归 Other User Content                                        |
| User Content → Photos or Videos        | No                      | 不上传相册；分享卡是 App 生成输出                                                                                 |
| User Content → Audio Data              | No                      | 音效仅播放，不录音                                                                                                |
| User Content → Gameplay Content        | No                      | 非游戏                                                                                                            |
| User Content → Customer Support        | Yes，条件               | 用户主动举报 AI 回答/内容反馈，服务端处理举报记录                                                                 |
| User Content → Other User Content      | Yes，条件               | 同步报告/日记/问题；可选在线 AI 对话、导出/分享的报告                                                             |
| Browsing History                       | No                      | 不采集外部网站浏览史                                                                                              |
| Search History                         | No                      | 城市/学习搜索在设备，不上传查询记录                                                                               |
| Identifiers → User ID                  | Yes，条件               | 第一方账号 ID 与会话，仅用于账户与跨设备同步。                                                                    |
| Identifiers → Device ID                | No                      | 首版不提供付款、购买或广告，也不采集相关数据。                                                                    |
| Purchases → Purchase History           | No（购买不可用）        | 首版不提供付款、购买或广告，也不采集相关数据。                                                                    |
| Usage Data → Product Interaction       | No（无广告）            | 首版不提供付款、购买或广告，也不采集相关数据。                                                                    |
| Usage Data → Advertising Data          | No                      | 广告展示、点击与广告测量                                                                                          |
| Usage Data → Other Usage Data          | No                      | 未另设全局使用追踪                                                                                                |
| Diagnostics → Crash Data               | No（本次无 Sentry DSN） | Sentry 原生代码保留；仅配置正式 DSN 才上报脱敏诊断。若发布时启用，须追加相应诊断类型，均不用于跟踪。              |
| Diagnostics → Performance Data         | No（本次无 Sentry DSN） | Sentry 原生代码保留；仅配置正式 DSN 才上报脱敏诊断。若发布时启用，须追加相应诊断类型，均不用于跟踪。              |
| Diagnostics → Other Diagnostic Data    | No（本次无 Sentry DSN） | Sentry 原生代码保留；仅配置正式 DSN 才上报脱敏诊断。若发布时启用，须追加相应诊断类型，均不用于跟踪。              |
| Surroundings → Environment Scanning    | No                      | 不扫描环境                                                                                                        |
| Body → Hands                           | No                      | 无手部追踪                                                                                                        |
| Body → Head                            | No                      | 无头部追踪；陀螺仪仅本地视差                                                                                      |
| Other Data → Other Data Types          | Yes，条件               | 同步生日、出生时间、性别、时区、档案关系、界面/提醒设置与设备型号等                                               |

## 3. 用途、关联与跟踪

所有 Yes 的账号、名称、邮箱、位置、用户内容、用户 ID 和其他数据：App Functionality；Linked to You = Yes；Used to Track You = No。出生地坐标是手动输入的历史地点，不读取 GPS，但允许三位以上小数并可同步，保守申报 Precise Location。Customer Support 包括主动举报，不能声称不收集。

Data Used to Track You = 无；Third-party Advertising / Developer Advertising = 无；Purchase History / Advertising Data / Device ID 不选择。设备型号归 Other Data Types，不是设备广告标识。无 GA4、Meta Pixel 或全局点击分析。

## 4. 实际处理与 SDK

- SQLCipher / SecureStore：设备档案、报告、日记与令牌加密；匿名资料只有确认导入才上传。
- Apple / Google / 邮箱登录：邮箱、第一方账号 ID、平台和设备型号用于登录与会话。Google openid/email/profile；Apple 仅邮箱。
- 通知与小组件：本地排程与展示快照，不注册远程推送令牌，不上传出生资料。
- Sentry：SDK 保留但本次没有正式 DSN，不初始化；未来启用必须申报 Crash Data、Performance Data 和实际原生诊断，不用于跟踪。
- MiniMax：用户主动在线追问时，第一方网关发送去标识化的问题、对话、派生命盘与解读，排除原始出生信息与账号身份。第一方对话加密存储，可删除、导出与举报。
- 删除：App「我的 → 设置」可直接删账号及反馈，立即注销会话、分享并清理当前设备账号缓存、提醒和小组件；服务端七天后硬删，请求上限 30 天。未导入匿名资料与其他离线设备缓存需单独清理。
- 导出：App 导出报告；完整账户 JSON 通过同账号网站设置或 privacy@gavin.pub 请求。

## 5. 清单与提交

Privacy Policy：对应 /en/privacy、/zh/privacy、/zh-TW/privacy；政策已改为目前不提供 App 内购买与广告，将来提供时会更新。本任务不部署，线上版本待 Owner 发布后核对。

主 PrivacyInfo.xcprivacy 与 Expo 清单无跟踪、广告或购买类型，保留实际第一方数据和可选诊断。最终签名 Archive 仍需生成 Xcode Privacy Report，与实际登录、同步、举报及 Sentry 配置逐项核对；模拟器 Release 不代替签名 Archive。
