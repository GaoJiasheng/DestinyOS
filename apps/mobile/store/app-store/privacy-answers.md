# App Privacy 填写答案 · 2026-10-12

对象：`pub.gavin.tianji`，1.0.0。按「收集数据 → 选择类型 → 每种类型用途 → 身份关联 → 跟踪 → 政策链接」顺序编排。未登录任何后台；题目用中文转述，选项保留 ASC 英文标签，后台顺序可能因版本变化而调整。

## 0. 先确定填写哪一列

本次无服务配置的 production Release：AdMob/UMP/ATT 未启用；RevenueCat 未配置，购买/恢复禁用；Sentry 没有 DSN，不上报。Apple 登录、邮箱登录及第一方同步代码仍存在；Google 缺客户端 ID 时不能登录。纯本地 SQLCipher 数据不是 Apple 定义的收集。

**本次 Release**列对应实际采集包；**服务启用后**列供 Owner 填正式启用 RevenueCat、AdMob 和 Sentry 的版本。不能把后者当作本次已发生的数据流，也不能在启用 SDK 后继续沿用前者。最终签名包与服务配置尚未提供，因此本文件不宣称最终 Archive 问卷已封板。

依据：`lib/monitoring.ts`、`lib/monetization/{ad-unit,native-consent,purchases,billing}.ts`、`release/production.ts`；第一方见 `apps/web/lib/mobile/{auth,sync}.ts`。服务启用必须来自真实 production 配置，不能采用测试 SDK key。

## 1. 你或第三方合作伙伴是否从 App 收集数据？

选择 **Yes**。可选登录、同步、举报等会发送并保存账号或用户内容；不能因为支持匿名离线模式选择 No。数据只在设备处理的部分不申报，但同步到服务端的加密数据仍需申报。按 [Apple 的收集定义](https://developer.apple.com/app-store/app-privacy-details/) 判断。

## 2. 选择所有收集的数据类型（ASC 类型清单顺序）

「条件」表示相应功能启用或用户主动使用才收集；不是可以从标签中省略。两列均覆盖第一方所有可用账号功能。

| 类型                                   | 本次 Release          | 服务启用后    | 实际数据或不收集原因                                                                                              |
| -------------------------------------- | --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Contact Info → Name                    | Yes，条件             | Yes，条件     | 档案名称/昵称可同步；与网站同账号已有显示名。Google profile scope 不代表 SDK 已上传姓名属性                       |
| Contact Info → Email Address           | Yes，条件             | Yes，条件     | Apple 隐藏邮箱或正常邮箱、Google/魔法链接邮箱，第一方账号与邮件投递                                               |
| Contact Info → Phone Number            | No                    | No            | 不要求电话                                                                                                        |
| Contact Info → Physical Address        | No                    | No            | 无住址字段；出生城市不作为邮寄地址                                                                                |
| Contact Info → Other User Contact Info | No                    | No            | 无其他联系字段                                                                                                    |
| Health & Fitness → Health              | No                    | No            | 不使用 HealthKit，不收集健康表单                                                                                  |
| Health & Fitness → Fitness             | No                    | No            | 摇卦加速度仅本地，不上传运动记录                                                                                  |
| Financial Info → Payment Info          | No                    | No            | Apple 处理支付方式，App/RevenueCat不获取卡号                                                                      |
| Financial Info → Credit Info           | No                    | No            | 无信用数据                                                                                                        |
| Financial Info → Other Financial Info  | No                    | No            | 无资产/收入表单；订阅见 Purchase History                                                                          |
| Location → Precise Location            | Yes，条件             | Yes，条件     | **保守申报**：手工出生地经纬度允许 ≥3 位小数并可同步；历史出生位置，不是 GPS/当前实时定位                         |
| Location → Coarse Location             | Yes，条件             | Yes，条件     | 同步的城市级出生地；启用 AdMob 后还包括 IP 推测区域。两者用途和跟踪必须分开判断                                   |
| Sensitive Info                         | No                    | No            | 不请求宗教、种族、性取向、遗传/生物识别等；生理性别/生日归 Other Data Types；自由文本不按所有可能敏感内容额外勾选 |
| Contacts                               | No                    | No            | 不读取通讯录；合盘从本地档案选择                                                                                  |
| User Content → Emails or Text Messages | No                    | No            | 无用户间聊天、收件箱读取；魔法链接是投递功能，AI 对话归 Other User Content                                        |
| User Content → Photos or Videos        | No                    | No            | 不上传相册；分享卡是 App 生成输出                                                                                 |
| User Content → Audio Data              | No                    | No            | 音效仅播放，不录音                                                                                                |
| User Content → Gameplay Content        | No                    | No            | 非游戏                                                                                                            |
| User Content → Customer Support        | Yes，条件             | Yes，条件     | 用户主动举报 AI 回答/内容反馈，服务端处理举报记录                                                                 |
| User Content → Other User Content      | Yes，条件             | Yes，条件     | 同步报告/日记/问题；可选在线 AI 对话、导出/分享的报告                                                             |
| Browsing History                       | No                    | No            | 不采集外部网站浏览史                                                                                              |
| Search History                         | No                    | No            | 城市/学习搜索在设备，不上传查询记录                                                                               |
| Identifiers → User ID                  | Yes，条件             | Yes，条件     | 第一方账号 ID/会话；启用 RevenueCat 后同一 User.id，绝不使用邮箱作为 appUserID                                    |
| Identifiers → Device ID                | No                    | Yes，广告条件 | AdMob 设备/广告标识；IDFA 须 ATT 同意，非个性化广告也可能有其他 SDK 标识                                          |
| Purchases → Purchase History           | No（购买不可用）      | Yes，条件     | RevenueCat/Apple 交易、产品、订阅、退款与权益；月订阅与非消耗型永久项                                             |
| Usage Data → Product Interaction       | No（无广告）          | Yes，广告条件 | AdMob App/广告交互；无 GA4、Meta Pixel 或全局点击分析                                                             |
| Usage Data → Advertising Data          | No                    | Yes，广告条件 | 广告展示、点击与广告测量                                                                                          |
| Usage Data → Other Usage Data          | No                    | No            | 未另设全局使用追踪                                                                                                |
| Diagnostics → Crash Data               | No（Sentry/广告关闭） | Yes           | Sentry 脱敏异常；AdMob 非用户关联崩溃日志                                                                         |
| Diagnostics → Performance Data         | No（Sentry/广告关闭） | Yes           | Sentry 仅允许启动/星空/历史数值；AdMob 启动、卡顿、能耗                                                           |
| Diagnostics → Other Diagnostic Data    | No（SDK关闭）         | Yes，保守     | 启用 Sentry 原生崩溃、SDK 技术环境信息时按最终 Privacy Report 确认                                                |
| Surroundings → Environment Scanning    | No                    | No            | 不扫描环境                                                                                                        |
| Body → Hands                           | No                    | No            | 无手部追踪                                                                                                        |
| Body → Head                            | No                    | No            | 无头部追踪；陀螺仪仅本地视差                                                                                      |
| Other Data → Other Data Types          | Yes，条件             | Yes，条件     | 同步生日、出生时间、性别、时区、档案关系、界面/提醒设置与设备型号等                                               |

Precise Location 比旧 M15 草稿更保守：`components/birth-form.tsx` 的 `manual-lat/manual-lng` 允许用户输入坐标。当前主隐私清单没有此项，也未列 Name/Customer Support/Other Diagnostic Data；正式提交前必须让最终 Archive 报告、营养标签与实际功能一致。该发现只记录，不在本文件任务中改 App 清单。

## 3. 对每个 Yes 类型依次填写三个问题

题 1：此类型用于哪些目的？按下表勾选。题 2：是否与你的用户身份关联？按下表 Yes/No。题 3：是否用于跟踪？按下表 Yes/No。未列目的均不勾选；没有 Developer’s Advertising or Marketing 或 Other Purposes。

F = App Functionality；A = Analytics；P = Product Personalization；T = Third-Party Advertising。

| 类型                             | 本次 Release：目的 / 关联 / 跟踪 | 服务启用后：目的 / 关联 / 跟踪        |
| -------------------------------- | -------------------------------- | ------------------------------------- |
| Name                             | F / Yes / No                     | F / Yes / No                          |
| Email Address                    | F / Yes / No                     | F / Yes / No                          |
| Precise Location（历史手工坐标） | F / Yes / No                     | F / Yes / No                          |
| Coarse Location                  | F / Yes / No                     | F、T、A / Yes / Yes（仅广告数据）     |
| Customer Support                 | F / Yes / No                     | F / Yes / No                          |
| Other User Content               | F、P / Yes / No                  | F、P / Yes / No                       |
| User ID                          | F / Yes / No                     | F、A / Yes / No                       |
| Device ID                        | 不选择                           | T、A / Yes / Yes（广告同意后）        |
| Purchase History                 | 不选择                           | F、A / Yes / No                       |
| Product Interaction              | 不选择                           | T、A / Yes / Yes（广告同意后）        |
| Advertising Data                 | 不选择                           | T、A / Yes / Yes（广告同意后）        |
| Crash Data                       | 不选择                           | F、A、T / No / No                     |
| Performance Data                 | 不选择                           | F、A、T / Yes / Yes（保守覆盖 AdMob） |
| Other Diagnostic Data            | 不选择                           | F / Yes（保守覆盖原生 SDK） / No      |
| Other Data Types                 | F、P / Yes / No                  | F、P / Yes / No                       |

同一类型有多个来源时 ASC 填其并集：例如出生城市本身永不跟踪，但启用 AdMob 后 Coarse Location 要覆盖广告 SDK。不能把 IDFA 受 ATT 约束写成「拒绝后 SDK 零收集」。用途 A 也包括 RevenueCat 的交易看板；旧草稿仅填写 Purchase History → F 不足。

## 4. SDK 与第一方实证

- **RevenueCat**：`react-native-purchases` 10.11.x；只在登录且有 `appl_` key 后配置。`Purchases.configure({appUserID:userId})`；无邮箱、出生字段、customer attributes 或广告标识集成。收集购买历史和 User ID，用于功能及 RevenueCat 交易统计，不跨其他公司 App 跟踪。用途同时覆盖 F/A，见 [RevenueCat 官方填写说明](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)。
- **AdMob + UMP + ATT**：`react-native-google-mobile-ads` 17.2.x。Release 缺 App ID/单元 ID 不初始化；缺 App ID 原生 GMA 也不链接。先 UMP 再 ATT，拒绝后走非个性化广告。SDK 类型按 Google 官方披露覆盖 IP 区域、标识、广告/交互、崩溃、性能；不传生日、提问、邮箱 targeting。SDK 类型依据 [Google iOS 披露](https://developers.google.com/admob/ios/privacy/data-disclosure)。
- **Sentry**：8.x 已依赖，但 `Boolean(DSN) && !__DEV__ && audit !== true` 才启用。本次无 DSN。启用后 `beforeSend` 丢弃 user/request/contexts/breadcrumbs/附件与自由文本，只留技术栈和白名单数值；replay、截图、视图树、日志、自动性能 tracing 均关闭。JS 已脱敏不等于原生崩溃完全匿名；本表保守列其他诊断关联，最终 Archive/真实事件复核。
- **邮件**：移动端调用 Worker 的现有发信接口；`lib/auth-email.ts → platform/email.ts` 实际 production 为 Cloudflare Email binding，Node 兼容路径可用 Resend。申报邮箱用于 F；不申报读取用户邮箱内容，不发送营销邮件。
- **Google / Apple**：Google OAuth scopes 为 openid/email/profile；iOS Apple 只请求 EMAIL scope（不请求 FULL_NAME）。Worker 保存 sub/email 与 User ID；Google 的 scope 不证明它另用于广告。Google 无 client ID 不可登录；服务启用前复核真实生产 OAuth。
- **本地加密**：SQLCipher 整库，32 字节密钥放 SecureStore，访问/刷新令牌也在 SecureStore。匿名资料不自动上传，用户确认导入后才同步。通知在本地计算排程；小组件 App Group 只写当天展示数据，无出生信息。传感器、星表/离线城市搜索不上传。
- **AI**：核心排盘无运行时模型；可选追问由第一方网关转交配置的 AI 服务，服务端保存对话与举报，归 Other User Content/Customer Support。不可笼统声称整个 App 不使用 AI。

## 5. 政策链接与发布预览

Privacy Policy URL：`https://tianji.gavin.pub/en/privacy`；简中 `/zh/privacy`；繁中 `/zh-TW/privacy`。Privacy Choices URL 可用对应政策页，页内解释导出、删除与广告撤回；这是可选字段，不使用需要登录的设置页当公开说明页。

本次现有政策只写 Web、浏览器存储与 30 天网站会话；移动会话为访问 15 分钟/刷新 60 天。需补充 SQLCipher/SecureStore、Apple 登录、AdMob/UMP/ATT、商店购买/续期、Sentry 开关、AI 接收方与保留、原生账户删除，以及删除账号不取消 Apple 订阅。**网页可访问不代表政策已覆盖 App**；本任务不改网页。

本次 Release 预览应有 Data Linked to You，无 Data Used to Track You；服务全启用后须出现广告类型的 Data Used to Track You，不能选 Data Not Collected。提交前对最终 Archive 生成 Xcode Privacy Report 并复核本表差异；本次模拟器不是最终签名 Archive。

官方核对（2026-10-12）：[Apple 填写流程](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)、[Apple 类型与跟踪定义](https://developer.apple.com/app-store/app-privacy-details/)、[Google iOS 数据披露](https://developers.google.com/admob/ios/privacy/data-disclosure)、[RevenueCat 问卷](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)。
