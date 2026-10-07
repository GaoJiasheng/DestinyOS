# M15 · 天机 / DestinyOS 发布操作手册

需求依据：00-app-plan §0、2–8、10、12；业务与隐私按 docs/00–14。Owner 在后台执行本手册；施工不创建付费服务、不上传密钥、不点提审。`pub.gavin.tianji`、Team `D33974QQTD`、App Group `group.pub.gavin.tianji` 不得改名。

## 1. 素材与本地重现

- `apps/mobile/store/metadata/{en,zh,zh-TW}.json`：标题、副标题、长描述、关键词、Play 简介。全部来自共享 `apps/web/messages`，通过 next-intl 导出。英文采用 §12 已建名称 **DestinyOS: BaZi & Tarot**，§8 原长标题超过商店 30 字符限制，未使用。
- `apps/mobile/store/screenshots/iphone-6.9/{locale}` 与 `iphone-6.5/{locale}`：各语言各 6 张品牌图；原图在 `apps/mobile/test-results/M15/raw`，`screenshots.json` 记录源文件、尺寸、SHA-256。依次为今日星空、八字、占星、塔罗、日历、学习。
- `store/feature-graphic.png` 为 Play 1024×500 头图，`assets/icon.png` 为 1024×1024 不透明 App 图标；`store/play-icon.png` 为 512×512 Play 图标。`adaptive-icon.png` 是 Android 前景。
- Android 素材尚未生成：Owner 暂不安装 Java，不能用 iPhone 图片替代 Android。安装 Java、Android SDK/模拟器后运行同一个流程生成 `android-phone/{locale}`。iPad 当前配置支持平板，因此正式提审前还需用 iPad 13 寸模拟器补截图并验收布局；本任务指定素材仅为手机。

```bash
pnpm install
pnpm --filter @tianji/mobile exec expo start --port 8081
# dedicated simulator, installed development binary; run once per size and locale
pnpm --filter @tianji/mobile store:capture <UDID> iphone-6.9 zh
pnpm --filter @tianji/mobile store:capture <UDID> iphone-6.5 en
# repeat zh / en / zh-TW for both phone sizes
pnpm --filter @tianji/mobile store:assets
pnpm --filter @tianji/mobile store:metadata
# only AFTER Owner provisions Android Java/SDK and installs a native development binary
adb reverse tcp:8081 tcp:8081
pnpm --filter @tianji/mobile store:capture <ANDROID_SERIAL> android-phone zh
# repeat en / zh-TW, then store:assets
```

Fixture A 是公开算法测试档案，截图只显示产品体验；`/dev/store` 在普通生产包中重定向至首页。截图使用真实页面，不包含诊断 UI。首次启动权限弹窗须在专用模拟器中完成后再截图；发布前复核字体、图表、文案与实际商店版本一致。可选 30 秒说明视频由 Owner 用正式测试包录制：离线出报告 → 摇卦/翻牌 → 小组件/本地提醒 → 切换语言。

## 2. EAS 与生产环境（从 apps/mobile 执行）

1. Owner 用自己的 Expo 账号创建/关联项目，`eas init`，把项目 UUID 放到 EAS **production** 环境的 `EAS_PROJECT_ID`；不要提交凭据或 `.env`。当前仓库不虚构项目 UUID。
2. EAS `production` profile 为 store 分发、Release、AAB、远程版本号自动递增、production channel；运行时采用 native fingerprint；Node 22.20.0 支持配置模块的原生 TypeScript 加载。Preview 留在 preview channel。首版版本 1.0.0。
3. 设置下表公开客户端配置。`EXPO_PUBLIC_*` 会进包，不能放服务端 secret；RevenueCat 仅公开 `appl_`/`goog_` SDK key，绝不能放 `sk_` server key。Sentry 上传 token、ASC API key、Play service account、签名资料使用 EAS 安全凭据存储。

| EAS production 变量 | Owner 获取位置 |
|---|---|
| `EAS_PROJECT_ID` | Expo 项目 UUID |
| `APP_VARIANT` | production；同时设置 EAS production 环境，保证 Update 也执行生产校验 |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` / `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | AdMob 对应平台 App ID，带 `~` |
| `EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID` / `EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_ID` | AdMob 原生广告单元 ID，带 `/` |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat 对应平台的公开 SDK key |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth 客户端；分别绑定 Bundle ID、包名/生产签名 SHA-1 |
| `EXPO_PUBLIC_APPLE_SERVICE_ID` | Apple 的 Android/Web OAuth Service ID（Owner 新建/核对，§12 未给出） |
| `EXPO_PUBLIC_SENTRY_DSN`、`SENTRY_ORG`、`SENTRY_PROJECT` | Sentry 移动项目；DSN 是公开上报地址 |

4. profile 已设置 `APP_VARIANT=production`、`EXPO_PUBLIC_M14_AUDIT=false`。删除 UMP debug geography 和 RevenueCat Test Store key。生产校验会拒绝缺配置、Google 示例 ID、审计开关、测试 key；本地预览可以用测试 ID。
5. OAuth：Apple Services ID 回调与 Worker `auth/apple` 配套；Google iOS URL Scheme 自动从 client ID 派生。验证域名 AASA（主 App 与 widget ID/Team）及 Android assetlinks（Play App Signing SHA-256），`https://tianji.gavin.pub/auth/verify` 真实邮件可唤起 App。
6. Worker 的 RevenueCat webhook/server key、Apple/Google OAuth、Resend、字段加密、AI/导出等依赖在 Owner 生产环境配置；Web 保持 `FEATURE_WEB_PAYMENTS=false`。验证 `/api/v1/health`、移动登录/刷新/同步、知识库签名。
7. `eas build --profile production --platform ios`；Android 必须等 Owner 完成 Java 与原生验收后再 `--platform android`。首次构建检查 widget Bundle ID `pub.gavin.tianji.widget` 被创建、加入同 App Group，主 App 与扩展 provisioning profile 都包含 group。
8. `eas submit --profile production --platform ios --id <BUILD_ID>` 上传 TestFlight；Android profile 只上传 internal draft。先手动在 Play 上传首个 AAB 以初始化应用，再安全配置 service account，执行 `eas submit --profile production --platform android --id <BUILD_ID>`。上传不等于正式提审。
9. EAS Update 已装入依赖；只允许 bug 修复，知识库变化优先签名数据包。`APP_VARIANT=production eas update --channel production --environment production --message '<fix>'` 前核对 fingerprint、回滚与商店规则；新功能必须新商店版本。不要在没有真实 EAS 项目配置的本地包宣称 OTA 已上线。

## 3. App Store Connect（复用 §12 已建记录）

1. 接受待签协议，核对税务/银行；申请 Small Business Program（资格由 Apple 审核）。进入 App `6819614010`、SKU `destinyos-ios`，不重复建 App。
2. App Information：核对英文名；添加简中/繁中名称，按 metadata JSON 填标题/副标题。选择与文化、自我反思相符的类别；如实填写年龄问卷，包括广告与 AI/用户输入能力，服务条款为 18+。年龄评级由问卷决定，不随意指定 4+。
3. Pricing and Availability：App 免费，**排除中国大陆和 EU27**。EU27：Austria、Belgium、Bulgaria、Croatia、Cyprus、Czechia、Denmark、Estonia、Finland、France、Germany、Greece、Hungary、Ireland、Italy、Latvia、Lithuania、Luxembourg、Malta、Netherlands、Poland、Portugal、Romania、Slovakia、Slovenia、Spain、Sweden；英国/瑞士不是 EU27。不要无意勾选未来自动新增所有地区。App 与内购的可售范围均核对；§12 174 个地区目前仅排中国，不代表已排 EU27。
4. 1.0.0 版本：逐语言粘贴描述/关键词，上传各 6 张对应尺寸图片；填 Support URL（Owner 发布可联系支持的页面）、Marketing URL `https://tianji.gavin.pub`、Privacy URL `https://tianji.gavin.pub/en/privacy`（中文对应 `/zh/privacy`、`/zh-TW/privacy`）。政策必须覆盖 App/SDK/购买/可选 AI，先实测网页可达。
5. 内购 `tianji_pro_lifetime`（`6819614424`，US$6.99 非消耗型）与 `tianji_pro_monthly`（`6819616346`，US$2.99/月，群组 `22444860`）核对三语显示名/说明、税务、可售区、永久项家人共享关闭。补**实际会员页审核截图**；不要用商店品牌宣传截图作为内购证明。首次内购必须选入 App 首版一同审核。
6. App Privacy：按 `apps/mobile/store/PRIVACY.md` 填营养标签，先从 Xcode Organizer 最终 Archive 生成 Privacy Report；核对 App + Widget + 全部 SDK 清单。ATT 解释三语已配置；拒绝不得阻止本地功能。填写广告标识用途。
7. Export Compliance：回答 AES-256/SQLCipher 与 TLS 的实际使用，核对标准加密豁免及发行地区；`ITSAppUsesNonExemptEncryption=false` 是当前实现的标准加密豁免声明，Owner 应依据问卷确认，不可当作「未使用加密」。如后台要求文档则上传后再发包。
8. TestFlight：设置内/外测组，真实 Apple 沙盒账号，测试购买、恢复、自动续期到期/退款、跨 Web 免广告、删除。Owner 与亲友至少试用一周；真机测试本地通知/锁屏小组件、VoiceOver 与离线；使用真实数据前检查 Sentry 脱敏。
9. Review Information：填 Owner 可即时联系的真实姓名、电话、邮箱；填写下方备注，附 30 秒演示。准备可用的演示账号（在私密 Review Information 填凭据，不入库），覆盖登录后的同步、恢复/会员；无需登录的离线体验说明清楚。不要只给 mock 登录或会过期的魔法链接。Apple/Google 登录必须可用。
10. 选择测试通过的 build、两项 IAP，选手动发布，检查所有警告后 Add for Review → Submit。被拒在 Resolution Center 按事实回复并附新视频，不通过关键词堆砌规避 4.3。

## 4. Google Play Console

1. 使用 Owner 现有账号，新建 `pub.gavin.tianji` 记录，设 App、免费、默认英语；完成开发者协议/身份、付款资料。加入符合资格的订阅费率计划。
2. Main store listing：添加简中/繁中，用 metadata 的 title、shortDescription、description；Play 没有副标题或独立关键词字段，不把 Apple keywords 填到描述里。上传 512×512 图标、1024×500 feature graphic、**Android 真机/模拟器各语言 6 张**手机素材。
3. App content：声明 contains ads；目标人群 18+；内容评级如实；填隐私政策 URL、Data safety 表、Advertising ID 问卷（GMA 合并 AD_ID permission），不声明定位/通讯录权限。AI 生成功能及其举报机制按 Play 表单如实说明。
4. App access：填写审查演示账号与不需登录步骤。Data deletion：填写公开网页删除请求 URL 与说明（需 Owner 发布，无需安装 App 可查看/请求；不能仅用登录后的设置页）；App 内仍可删除。核对政策保留期。
5. Monetize：建 subscription `tianji_pro_monthly`，激活月周期 auto-renewing base plan（base plan ID Owner 选择并填 RevenueCat），美国 US$2.99；建一次性 non-consumable `tianji_pro_lifetime` US$6.99，激活购买选项。不要建年付或可消耗的永久权益。
6. Setup → App integrity：启用 Play App Signing，保管 upload key（不入库）、记录商店签名 SHA-1/SHA-256，用于 Google 登录/assetlinks。在 API access 关联服务账号，最小权限给 RevenueCat（订单/订阅）与 EAS Submit（版本上传）；凭据只存各后台。
7. Countries/regions：App/测试轨道/产品都排中国大陆与上述 EU27。按后台资格完成 internal → 必要的 closed testing / production access（测试人数与天数以该账号后台实际要求为准）。
8. Owner 安装 Java 后执行 Android prebuild、原生 Release 构建及模拟器/真机验收：三个小组件 2×2/4×2/4×4、午夜更新、Android 13+ 通知、摇卦、TalkBack、登录/同步、购买/退款、UMP/非个性化广告。生成 M15 Android 图后再上传 internal AAB，设置 license testers。
9. 内测一周通过后先提 Android 正式版，审核通过后再 iOS；先用 managed publishing 保留 Owner 发布控制。复核 current target API 要求、pre-launch report 与 SDK warnings，处理崩溃后提 production。

## 5. RevenueCat

1. 创建项目和 iOS/Android App，绑定 `pub.gavin.tianji`；连接 ASC In-App Purchase key（.p8、安全私存）及 Google service account。凭据不用公开 SDK key 替代。
2. 导入**准确产品 ID** `tianji_pro_monthly` / `tianji_pro_lifetime`，Google 月项对应实际 base plan；两个产品都授予同一个 entitlement **`pro`**。SDK 直接取这两个产品，没有强依赖 offering 名；若建 default offering 用 monthly/lifetime 对应 package。
3. public SDK keys 放 EAS 对应变量；server API key 仅放 Worker。保持以网站 `User.id` 标识会员，禁止邮箱/匿名 ID 替代；核对跨平台 restore/transfer 策略与账号切换不泄漏权益。
4. 设置 webhook `https://tianji.gavin.pub/api/v1/mobile/webhooks/revenuecat`，Authorization 与 Worker `REVENUECAT_WEBHOOK_AUTHORIZATION` 完全一致（采用 RevenueCat 控制台标准 Authorization 方式；标准控制台集成应移除 `REVENUECAT_WEBHOOK_SECRET`，否则后端会额外要求自定义 HMAC，拒绝标准回调）；送出 sandbox 测试验证鉴权、幂等、退款、到期/宽限、永久权益；Worker production/test 环境策略与真实测试事件匹配。
5. 用真实商店沙盒购买与恢复（不是 RC Test Store），查看 Customer → entitlement，再同账号打开网站确认免广告。验证取消续订仍有效至到期、退款撤销、登录设备撤销与账户删除。

## 6. AdMob

1. 新建 iOS/Android App，绑定包名，上架后关联对应商店 URL；核对付款、政策中心、App readiness 与 app-ads.txt 验证。Owner 将 AdMob 提供的准确 publisher 记录发布到主域 `/app-ads.txt`，不把示例 ID 发布。
2. 每个平台创建 Native Advanced 原生单元，分别填 EAS App ID（`~`）和 native unit（`/`）。生产不使用 Google 示例库存；调试包始终测试广告，内部测试设备登记为 test device，避免真实自点。
3. Privacy & messaging：配置 UK/CH 等适用地区的 UMP 欧洲法规消息及美国州法消息/RDP；EU27 禁售不等于 UK/CH 不需同意。先 UMP、再 iOS ATT；撤回入口在我 → 设置/会员隐私选项。
4. 真机验证拒绝、允许、撤回、ATT deny、未知年龄/13–17 非个性化、13 以下阻断、会员无广告、最多两个报告广告/一个今日广告。出生信息、提问、邮箱不得进入任何广告 targeting/identifier payload。
5. 无开屏/插屏。No-fill 静默收起，不伪造内容卡。上线前核对 SDK privacy report、AdChoices、布局及广告点击区域。

## 7. 可粘贴审核备注（Owner 补真实联系人、演示账号与视频）

### English (App Store Connect / Play App access)

DestinyOS is a native React Native app, not a web wrapper. It combines seven Chinese and Western charting traditions plus numerology: BaZi, Zi Wei Dou Shu, I Ching (Mei Hua and Liu Yao), Qi Men Dun Jia, tarot, Western astrology, and Vedic astrology. The offline chart engine and core readings use deterministic rules and a versioned knowledge library, with inspectable charts and reasoning. Core readings are not generated by an AI model at runtime. The optional online Ask the Master feature is separately labeled as AI-generated and includes a report button.

Distinctive native features include gesture-based tarot shuffling/cutting/selection, shake-to-cast Liu Yao with a button alternative, haptic feedback, a real star catalog, local daily reminders, and home/lock-screen widgets. English, Simplified Chinese, and Traditional Chinese are available. Basic charts and readings work in airplane mode without signing in; sign-in, sync, PDF export, share links, purchases, and AI follow-up need a connection. To test: complete onboarding, optionally enter an adult birth profile under Me, then open Readings or Today. Add the DestinyOS widget from the system widget gallery. Notification permission is optional.

All chart systems are free. The only paid benefit is removing ads: tianji_pro_monthly (US$2.99/month) and tianji_pro_lifetime (US$6.99 non-consumable). Local store prices apply. Me → Membership includes Restore purchases and Manage subscription after sign-in. These purchases grant the same pro entitlement across the app and website when signed into the same account; the app does not direct users to external payment. Me → Settings → Delete account provides in-app deletion. Birth details are encrypted and never supplied to advertising SDKs. UMP/ATT choices do not block local readings. Content is for entertainment, cultural learning, and reflection for adults, with no medical, financial, or guaranteed-outcome claims.

Reviewer credentials: [Owner inserts a working account through the private review form]. Demo video: [Owner inserts private video link]. Contact: [Owner inserts real name, phone, and monitored email]. Both initial in-app purchases are attached to this first version submission.

### 简体中文

天机为原生 App，包含七大中西体系与生命灵数，非网页套壳。本地排盘与基础解读来自确定性规则和版本化知识库，不在运行时由 AI 编造；用户可查看命盘与解读依据。可选在线「追问大师」单独标明 AI 生成并提供举报按钮。原生特色包括手势洗切选翻塔罗、摇手机六爻（也有按钮）、触感反馈、真实星表星空、本地提醒、桌面与锁屏小组件，以及简中、繁中、英文切换。飞行模式与未登录状态可以使用本地排盘和基础解读；登录/同步、导出、分享链接、购买与 AI 追问需要网络。所有体系免费，付费仅去广告，月订阅与非消耗型永久项均使用商店内购，支持恢复与系统订阅管理，无外部付款引导。账户可在「我 → 设置 → 删除账户」删除；出生信息加密且不传给广告 SDK。拒绝广告跟踪不影响本地功能。内容仅供 18+ 娱乐、文化学习与自我反思，不做医疗、财务承诺。

繁体备注可使用英文版本配合繁中界面演示；商店繁中标题/副标题/描述/关键词已单独提供。不得将开发诊断路由、模拟登录、测试购买或尚未验收的 Android 作为正式审核证据。

## 8. 提审前未满足门槛

- Android 原生构建、模拟器/真机验收与 18 张本地化素材：按 Owner 暂缓 Java 的要求待办。
- iPad 截图/布局、实体机通知/小组件、TestFlight/Play 一周真实商店内测、正式生产服务 ID 和签名：Owner 执行。
- 演示账号、审核视频、内购审核截图、公开删除说明/请求网页、支持页面、隐私政策 App 补充、最终 Archive 隐私报告与 export 问卷：Owner 完成后才能提审。

参考：上述后台填法于 2026-10-07 核对官方 [Apple 截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)、[Play 数据安全](https://support.google.com/googleplay/android-developer/answer/10787469)、[EAS 配置](https://docs.expo.dev/eas/json/)、[EAS 环境变量](https://docs.expo.dev/eas/environment-variables/usage/)；平台政策更新以提审时后台要求为准。
