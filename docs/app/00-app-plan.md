# 天机 App 方案（iOS + Android）

> 版本 v0.2 · 2026-10-06 · 作者 Claude · Owner Gavin
> 本文是移动端的总方案与施工拆分。Web 端文档（docs/00–14）仍是业务规则、算法、文案、隐私要求的唯一来源，本文只写 App 特有的部分，凡与 Web 一致的地方直接引用。

## 0. Owner 已确认的决定（2026-10-06）

| # | 决定 | 结论 |
|---|---|---|
| A1 | 技术路线 | Expo（React Native）+ 复用现有 TypeScript 包；前提是 §2.4 列出的全部特效都能实现，M-02 先做特效验证 |
| A2 | 开发者账号 | Owner 已有 Apple 与 Google 开发者账号（已上架多个 App），直接使用 |
| A3 | 上架地区 | 排除中国大陆与欧盟 27 国（不声明欧盟《数字服务法》交易商身份）；网站不受此限 |
| A4 | 去广告付费 | 两个产品：**2.99 美元/月订阅**，或 **6.99 美元永久买断**（一次性购买）。**Web 端暂不收款**（不开 Stripe），网页上的会员入口引导去 App 购买；Stripe 代码保留在功能开关后，将来可开启 |
| A5 | 跨端会员 | 支持。Apple、Google 任一渠道购买，App 与网站都免广告（RevenueCat 统一权益，网站用同一账号登录即生效） |
| A6 | 每日推送 | **默认开启**（首次启动即请求通知权限）。设备上**有出生档案**的用户推送当日运势；**没有档案**的用户推送引导文案，邀请进 App 填信息测运势。全部为本地计算、本地排程，离线也能按时推送 |
| A7 | 首发范围 | Web 全部体系与功能 + App 独有功能，一次做完 |
| A8 | 摇一摇起卦 | 六爻页支持摇手机，同时提供「摇卦」按钮；「问」弹层里也提供摇卦入口 |
| A9 | 触感与特效 | 由设计方决定，按最好效果做（§2.4、§4.4） |
| A10 | 离线 | 必须支持；离线时「追问大师」不可用，其余本地可算的功能全部可用 |
| A11 | 生物识别锁 | 不做，系统自带的 App 锁已覆盖 |

## 1. 为什么要做 App，做成什么样

Web 已经能用，App 的价值不在于"再做一遍"，而在于 Web 做不到的四件事：

1. **每天被提醒**：推送和桌面小组件让"每日运势"真正变成每天打开的习惯，这是命理类产品留存的核心。
2. **仪式感更强**：摇手机起六爻、触感反馈的翻牌和铜钱，比鼠标点击有代入感得多。
3. **离线可用**：排盘引擎是纯 TypeScript、零网络依赖，App 里直接本地算，没网也能排盘、看今日运势，速度也更快。
4. **商店分发**：App Store 与 Google Play 的搜索流量，以及 App 内订阅的便捷付款。

原则：**App 是 Web 的原生版，不是 Web 的套壳。** 业务规则、知识库、文案全部共享；界面按 iOS 与 Android 的原生习惯重做。

## 2. 技术路线

### 2.1 三个选项的比较

| 方案 | 说明 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| Capacitor 套壳 | 把现有 Next.js 网页装进原生壳 | 最快，几天可上架 | Apple 审核条款 4.2「最低功能」与 4.3「重复类别」对套壳占星 App 拒审率高；动画、手势、小组件体验差；Next.js 服务端渲染要改成纯静态 | 不选 |
| **Expo / React Native** | 用 React 写原生界面，复用所有 TS 包 | 引擎、解读、知识库、文案、校验 100% 复用；原生性能与手势；小组件、推送、内购、广告都有成熟库；EAS 一键构建与提交；团队（Codex）对 React 最熟 | 界面层要重写一遍 | **选这个** |
| Swift + Kotlin 原生 | 两套原生代码 | 体验上限最高 | 引擎要移植两遍或靠 JS 引擎调用，工作量三倍，维护两套 | 不选 |

### 2.2 选型清单

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | Expo SDK（最新稳定版）+ React Native 新架构 + TypeScript strict | 与 Web 同一 monorepo，`apps/mobile` |
| 路由 | Expo Router（文件路由） | 结构对齐 Web 的路由，深链接天然支持 |
| 状态与数据 | TanStack Query（服务端数据）+ Zustand（界面状态） | 与 Web 一致 |
| 本地存储 | expo-sqlite（开启 SQLCipher 加密）存匿名档案、报告、日记；expo-secure-store 存登录令牌与本地加密主密钥 | 出生信息在设备上也是加密的 |
| 图形 | @shopify/react-native-skia（命盘、星盘、粒子、星空）；react-native-svg 仅作后备 | Skia 是 GPU 绘制，60fps 星空与粒子没问题 |
| 动画与手势 | react-native-reanimated + react-native-gesture-handler | 翻牌、洗牌、拖拽切牌 |
| 触感 | expo-haptics | 翻牌、铜钱落地、星级填满 |
| 传感器 | expo-sensors（加速度计） | 摇一摇起卦 |
| 推送 | expo-notifications：**本地通知为主**（设备上算好未来 7 天运势提前排程，零服务器成本），远程推送仅用于公告 | 见 §4.1 |
| 小组件 | iOS：expo-apple-targets 生成 WidgetKit 扩展（SwiftUI，读取 App Group 共享数据）；Android：react-native-android-widget | 见 §4.2 |
| 内购 | react-native-purchases（RevenueCat） | 统一 Apple、Google、Stripe 权益 |
| 广告 | react-native-google-mobile-ads（AdMob）+ Google UMP 同意弹窗 + iOS ATT 跟踪授权 | Web 用 AdSense，App 必须用 AdMob |
| 登录 | Sign in with Apple（iOS 必须提供，Apple 条款 4.8）+ Google 登录 + 邮箱魔法链接（通用链接打开 App） | 见 §5 |
| 国际化 | i18next，直接读取 `apps/web/messages/*.json` 编译出的同一份文案；zh、zh-TW、en | 文案不复制 |
| 字体 | expo-font 内嵌同一套子集字体（文楷、Noto Serif SC、Cinzel、Cormorant、Inter） | 视觉一致 |
| 分享与导出 | expo-sharing；PDF 直接调用 Web 的导出接口下载后用系统分享面板 | 不在设备上重做 PDF |
| 崩溃与监控 | Sentry React Native，同 Web 的脱敏规则 | |
| 构建与发布 | EAS Build、EAS Submit、EAS Update（只用于修 bug 与知识库热更新，不用来上新功能，符合 Apple 规则） | 免费额度不够时本机构建 |
| 测试 | Jest + React Native Testing Library（单元）；Maestro（端到端，iOS 模拟器与 Android 模拟器） | |

### 2.3 Monorepo 改动

```
apps/
  web/            现有
  mobile/         新增 Expo 应用
    app/          Expo Router 路由
    components/
    native/       iOS 小组件（SwiftUI）、Android 小组件
    app.config.ts
    eas.json
packages/
  engine/ interpret/ content/ shared/   现有，App 直接依赖
  ui-core/        新增：从 Web 组件里抽出的「纯计算」部分（命盘几何布局、星盘重叠错位算法、五行环比例、雷达坐标、颜色 token），Web 与 App 共用；不含任何 DOM 或 React Native 代码
  api-client/     新增：类型安全的 API 客户端（基于 shared 里的 Zod schema），Web 与 App 共用
```

**关键前提**：`@tianji/engine` 与 `@tianji/interpret` 已经要求不依赖 Node 与 DOM（docs/09 §2.1），施工第一步就是在 Hermes 引擎里跑通 Fixture A 七体系，若有不兼容（如 `crypto`、`Intl` 时区、`TextEncoder`）用 polyfill 或在包内改为可注入实现。

### 2.4 特效实现对照（Owner 要求：Web 的特效在 App 上都要有）

| Web 特效 | App 实现 | 性能目标 |
|---|---|---|
| 首页真实星空（BSC5 星表、按所在地天顶定向、行星标注、流星） | Skia `Canvas` + `Atlas`/`Points` 绘制 9000 颗星，着色器按星等与色指数上色；陀螺仪视差（expo-sensors）；流星为 Skia 路径动画 | 中端机 ≥ 55fps，低电量模式降为静态 |
| 3D 天球星盘（占星 3D 模式） | `@react-three/fiber/native` + `expo-gl`（与 Web 同一套 three 场景代码，抽到共享包）；不可用时退回 Skia 2D | ≥ 45fps |
| 粒子（金粉、墨滴、星尘） | Skia + Reanimated 共享值驱动的粒子系统，`useParticles` 同名同参数 | 80 粒子 60fps |
| 塔罗翻牌 3D | Reanimated `rotateY` + `perspective`，翻转中边缘金光为 Skia 渐变遮罩；逆位二次旋转 | 60fps |
| 洗牌、切牌、扇形选牌、飞入牌位 | Gesture Handler 拖拽与滑动 + Reanimated 布局动画；扇形只渲染可见的约 25 张 | 60fps |
| 铜钱 3D 落下 | Reanimated 3D 变换 + 物理弹跳曲线 + 触感 | 60fps |
| 卦象逐爻生成、动爻光环 | Skia 路径动画 | 60fps |
| 四柱光柱升起、五行环、雷达图入场 | Skia + Reanimated | 60fps |
| 紫微方格盘、三方四正连线、九宫依次点亮 | Skia 绘制 + 点击命中检测；双指缩放 | 60fps |
| 占星轮盘（行星飞入、相位线绘制） | Skia 路径与 `strokeEnd` 动画，几何计算复用 `packages/ui-core` | 60fps |
| 星级填满、页面转场、滚动触发金线 | Reanimated | 60fps |
| 分享卡与 A4 导出 | 分享卡：Skia 离屏渲染为 PNG；PDF 与 A4 图片：调用 Web 导出接口（保证与 Web 完全一致） | — |

**M-02 必须先交付一个「特效样机」页**：星空、3D 天球、粒子、翻牌、铜钱、轮盘六项在 iPhone 与中端 Android 模拟器上录屏并报告帧率。任何一项达不到目标，先在样机阶段解决，再进入正式施工。

## 3. 页面与导航

### 3.1 导航结构

底部 Tab 5 项，与 Web 移动端一致：

| Tab | 内容 |
|---|---|
| 今日 | 每日运势（Web 的 13 个区块），顶部日期左右滑动切换 |
| 推算 | 七体系 + 生命灵数 + 合盘的入口网格；有档案时一键出报告 |
| **问**（中央大按钮） | 快速占卜底部弹层：塔罗单张、梅花随机、摇一摇六爻、追问大师 |
| 学习 | 百科、64 卦、78 牌、术语、入门长文（内容随知识库更新） |
| 我 | 档案（多档案切换）、历史、日记、会员、设置 |

### 3.2 页面清单（与 Web 的对应关系）

| App 页面 | 对应 Web | App 特有差异 |
|---|---|---|
| 启动与引导（3 屏） | 无 | 星空动画 → 「天机是什么」→ 免责与 18+ 确认 → 可选「现在填出生信息」 |
| 出生信息表单 | `/me/birth`、`<BirthForm>` | 原生日期滚轮、13 档时辰滚轮、城市搜索走离线城市库（打包约 3 MB 的精简版） |
| 各体系报告页 | `/[system]/r/[id]` | 命盘区可双指缩放、点宫位底部弹出详情；章节用原生折叠；长按段落复制 |
| 塔罗仪式 | `/tarot/reading` | 手指划动洗牌、拖拽切牌、扇形滑动选牌、翻牌触感 |
| 六爻 | `/iching` | 摇一摇手机起卦（6 次），也保留按钮 |
| 奇门、梅花 | 同 Web | 起局九宫点亮配触感节拍 |
| 每日运势 | `/today` | 下拉刷新、左右滑日期、长按「今日卡」生成分享图 |
| 运势日历 | `/today/calendar` | 原生月视图 |
| 追问大师 | `/r/[id]/chat` | 原生聊天界面，流式输出 |
| 合盘 | 合盘流程 | 从系统通讯录选人**不做**（隐私），只从已有档案里选 |
| 日记 | `/me/journal` | 推送里直接点「今天怎么样」快速记录 |
| 设置 | `/me/settings` | 推送开关与时间、特殊日提醒、小组件主题、触感开关 |
| 会员 | `/pricing`、`/me/billing` | 原生内购页 |
| 登录 | `/auth/login` | Apple、Google、邮箱三种 |

视觉沿用 docs/03 的全部 token 与两套主题；Three.js 星空改为 Skia 实现（同一份 BSC5 星表、同一套着色规则）。所有页面遵循系统的深色模式、动态字体大小与「减少动态效果」设置。

## 4. App 独有功能

### 4.1 每日推送（默认开启，本地计算、本地排程，离线可用）

- 首次启动的引导第二屏请求通知权限（iOS 系统弹窗、Android 13+ 运行时权限），设置里「每日推送」默认开启，时间默认 8:00 本地时间，可改、可关。
- **有出生档案的用户**（无论是否登录，只要设备上有档案）：设备上用引擎算出未来 7 天每日运势，排程为本地通知，每次打开 App 与后台刷新时滚动补齐。内容示例：「今日 ★★★★ · 宜推进，忌争辩。幸运色：朱红」。点通知直达今日页。
- **没有档案的用户**：同样每天推送，内容为引导文案，按天轮换（约 30 条，zh/zh-TW/en），结合当日公共天象，例如「今天满月在白羊。填上生日，看看它对你意味着什么」。点通知直达出生信息表单。
- 特殊日附加提醒（可单独关闭）：节气、新月满月、水逆开始与结束、个人大运或流年交接。
- 全部为本地通知：不需要推送服务器，零费用，出生信息不出设备，离线照常按时到达。远程推送只保留给运营公告，默认不发。
- 用户在系统里拒绝了通知权限时，今日页顶部显示一次可关闭的提示，引导去系统设置开启。

### 4.2 桌面小组件

| 平台 | 尺寸 | 内容 |
|---|---|---|
| iOS | 小 | 今日总评星级 + 幸运色块 |
| iOS | 中 | 今日一句 + 五维星级 + 幸运色/数字 |
| iOS | 大 | 中号内容 + 今日一牌缩略图 + 吉时 |
| iOS | 锁屏（圆形、矩形） | 星级 / 今日一句 |
| Android | 2×2、4×2、4×4 | 对应 iOS 小、中、大 |

- 数据由 App 计算后写入共享存储（iOS App Group、Android SharedPreferences），小组件只读不算，每天午夜后由后台任务刷新。
- 小组件里不显示任何出生信息。

### 4.3 摇一摇起卦

六爻页与「问」弹层都提供入口，摇手机与点「摇卦」按钮两种方式等效。六爻摇卦时，每次摇动手机触发一次掷铜钱（加速度阈值 + 0.8 秒防抖），配铜钱落地触感与音效；随机数仍由 seed 驱动（摇动时刻参与 seed），保证可复现。

### 4.4 触感与音效

翻牌、洗牌、铜钱、星级填满、九宫点亮各一套触感模式；音效默认关闭，遵循系统静音键。

### 4.5 离线模式

- 未登录也能完整使用全部本地可算的体系（排盘 + 解读都在设备上），报告存在加密的本地数据库。
- 需要网络的功能：登录与同步、追问大师、PDF 导出、分享链接、会员购买。离线时这些入口显示「需要网络」。
- 知识库随 App 打包一份，联网时按 `knowledgeVersion` 增量更新（下载压缩包，校验签名后替换），无需发新版本。

## 5. 账号、同步与后端接口

### 5.1 登录

- **Sign in with Apple**（iOS 必须，Android 也可用）、**Google**、**邮箱魔法链接**。
- App 不用 Web 的 Cookie 会话。新增移动端令牌机制：
  - App 完成 OAuth（PKCE）后，把身份凭证交给 Worker 的 `/api/v1/mobile/auth/*`，换取**访问令牌（15 分钟）+ 刷新令牌（60 天，一次性轮换）**，存在 SecureStore。
  - 魔法链接邮件里的链接是通用链接 `https://tianji.gavin.pub/auth/verify?...`，装了 App 时直接唤起 App 完成登录，没装则走网页。
- 后端在 D1 新增 `MobileSession` 表（令牌哈希、设备名、平台、创建/最后使用时间），「我 → 设置 → 登录设备」可查看并逐个注销。
- 删除账号必须能在 App 内完成（Apple 条款 5.1.1(v)），复用 Web 的删除流程。

### 5.2 同步

- 同步对象：档案、报告、日记、设置。规则：服务端为准，按 `updatedAt` 后写覆盖；删除用墓碑记录。
- 登录时把本地匿名数据合并到账号（复用 Web 的导入逻辑，弹窗让用户确认）。
- 出生信息上传时仍由服务端加密存储；设备本地另用设备密钥加密。两边都不出现明文落盘。

### 5.3 新增接口（`/api/v1/mobile/*`，Bearer 令牌鉴权）

| 接口 | 说明 |
|---|---|
| `POST auth/apple`、`auth/google`、`auth/magic/verify` | 换取令牌 |
| `POST auth/refresh`、`POST auth/logout`、`GET/DELETE auth/sessions` | 令牌与设备管理 |
| `GET/PUT sync/profiles`、`sync/readings`、`sync/journal`、`sync/settings` | 增量同步（`since` 游标） |
| `GET knowledge/manifest`、`GET knowledge/bundle/:version` | 知识库增量更新（R2 存包） |
| `POST chat/:readingId` | 追问大师（流式，复用 Web 实现与配额） |
| `POST export/:readingId` | PDF / A4 图片导出（复用 Web 实现），返回下载链接 |
| `POST share/:readingId` | 分享链接（复用） |
| `POST entitlements/sync` | 购买后立即刷新会员状态 |
| `POST webhooks/revenuecat` | RevenueCat 回调，更新 `User.plan` |

所有接口沿用 Web 的 Zod 校验、限流、日志脱敏规则（docs/07、docs/08）。

## 6. 变现

### 6.1 内购（商店强制）

- Apple 与 Google 规定：App 内解锁数字内容（去广告属于此类）必须走商店内购，不能在 App 里引导去 Web 付款。
- 产品：`tianji_pro_monthly`（自动续期订阅，2.99 美元/月）、`tianji_pro_lifetime`（非消耗型一次性购买，6.99 美元，永久去广告）。两者在 RevenueCat 里映射到同一个权益 `pro`。网站暂不收款：`FEATURE_WEB_PAYMENTS=false`；Web 仅展示权益、同样两档价格与 App 下载入口。Stripe 两档实现保留供未来显式开启，取消年付。
- 加入两家商店的「小型开发者计划」，抽成 15%。
- RevenueCat `pro` 统一 App 与 Web 权益；SDK 使用网页账户的同一 `User.id` 作为 `appUserID`，禁止用邮箱或匿名 ID 替代。App 购买经已验签、幂等的 `/api/v1/mobile/webhooks/revenuecat` 写回 Worker；Web 可刷新 REST 当前会员状态，缺 server key 时跳过。非消耗型永久权益、订阅到期/宽限和退款均同步；历史有效 Stripe 权益保留。未来开 Web 支付后 Stripe webhook 继续同步 RevenueCat。
- 恢复购买按钮、订阅管理跳转系统订阅页、到期与退款处理。

### 6.2 广告（AdMob）

- 只对免费用户展示；位置与 Web 一致（每日运势中部、报告章节之间），每页最多 2 个，原生广告样式贴合卡片。
- **不做**开屏广告与插屏广告（体验差，也容易触发商店差评）。
- 同意流程：首次启动先走 Google UMP（欧盟、英国、瑞士及美国州法地区），iOS 再弹 ATT 跟踪授权；拒绝则展示非个性化广告。13–17 岁用户只展示非个性化广告。

## 7. 隐私与商店合规

| 项 | 做法 |
|---|---|
| Apple 隐私营养标签、Google 数据安全表 | 按实际填写：账号（邮箱）、出生信息（用于提供服务、加密、不用于跟踪）、广告标识（仅在同意后用于广告）、崩溃数据 |
| 隐私清单（PrivacyInfo.xcprivacy） | 声明所用的系统 API 与第三方 SDK |
| 账号删除 | App 内可删（§5.1） |
| 年龄 | 与条款一致 18+；商店年龄分级问卷如实填写 |
| 内容 | 每份报告底部免责声明；禁用词规则沿用 docs/05 §7；不做健康、财务承诺 |
| 审核风险：条款 4.3「重复类别」 | 占星类是饱和类别。提审说明里突出差异：七大中西体系、离线排盘引擎、双语、无运行时 AI 编造、真实星空。首次提审准备好演示账号与说明视频 |
| 审核风险：条款 4.2「最低功能」 | 原生实现 + 小组件 + 推送 + 离线，规避套壳认定 |
| 追问大师 | 标注由 AI 生成；提供举报入口；系统提示已禁止医疗、财务建议 |

## 8. 发布流程

1. **账号**：使用 Owner 现有的 Apple 与 Google 开发者账号。
2. **标识**：Bundle ID / 包名 `pub.gavin.tianji`；App 名「天机 · 命理与星盘」/「DestinyOS: BaZi, Tarot & Astrology」（商店标题含关键词，有利商店搜索）。
3. **商店素材**：6.9 寸与 6.5 寸 iPhone 截图各 6 张、Android 手机截图 6 张、30 秒预览视频（可选）、中英两套描述与关键词；由 Codex 用模拟器自动截图并套模板生成。
4. **测试**：iOS TestFlight 内测、Google Play 内部测试轨道，Owner 与亲友试用一周。
5. **提审**：先 Android（审核快），后 iOS；iOS 被拒按审核意见修改再提。
6. **更新节奏**：功能更新走商店版本；bug 修复与知识库更新走 EAS Update 与知识库增量包。

## 9. 费用

开发者账号已有，新增费用为零：EAS 用免费额度或本机构建，RevenueCat 年收入 10 万美元以内免费，AdMob 与本地推送免费，后端复用现有 Cloudflare。

## 10. 施工拆分（交给 Codex）

每个任务的通用约束同 Web（`.codex-runs/common.md`），另加：App 代码在 `apps/mobile`；所有界面必须在 iOS 模拟器与 Android 模拟器各截图验收；不提交任何签名证书与密钥。

| 编号 | 任务 | 依赖 | 验收 |
|---|---|---|---|
| M-01 | 脚手架：Expo + Expo Router + TS strict + 依赖 workspace 包；设计 token 从 Web 抽成共享常量；字体内嵌；三主题 | 无 | iOS 与 Android 模拟器启动显示品牌首屏 |
| M-02 | 引擎在 Hermes 上运行（Fixture A 七体系 + 每日运势，单体系 ≤ 300ms）+ §2.4 特效样机页六项 | M-01 | 设备内测试通过；样机录屏与帧率报告达标 |
| M-03 | 抽出 `packages/ui-core` 与 `packages/api-client`，Web 改为依赖它们且行为不变 | M-01 | Web 全部测试仍通过 |
| M-04 | 本地数据层：加密 SQLite、档案/报告/日记模型、匿名模式 | M-02 | 单测 |
| M-05 | 导航骨架 + 引导页 + 出生信息表单（离线城市库） | M-04 | Maestro 流程 |
| M-06 | 报告页通用布局与七体系命盘组件（Skia），点击联动、缩放 | M-03、M-05 | 七体系截图基线 |
| M-07 | 占卜仪式：塔罗（手势洗切选翻）、六爻（摇一摇）、梅花、奇门；触感与音效 | M-06 | Maestro 流程 |
| M-08 | 今日运势、运势日历、日记、星空首屏（Skia） | M-06 | 截图基线 |
| M-09 | 后端：移动端令牌认证、同步接口、知识库增量包、RevenueCat webhook（在 Cloudflare Worker 内实现） | 无（可与 M-01 并行） | 接口测试 |
| M-10 | 登录（Apple、Google、魔法链接通用链接）、同步、设备管理、账号删除 | M-09、M-05 | Maestro 流程（mock 身份） |
| M-11 | 本地推送（有档案推运势、无档案推引导、特殊日提醒、7 天滚动排程）、iOS 与 Android 小组件 | M-08 | 模拟器截图 + 推送测试 |
| M-12 | 追问大师、PDF 导出、分享、合盘、多档案 | M-10 | Maestro 流程 |
| M-13 | 内购（月订阅 + 永久买断，RevenueCat 沙盒）与 AdMob（测试广告单元）+ UMP + ATT | M-10 | 沙盒购买、恢复购买、广告显示与隐藏 |
| M-14 | 无障碍（VoiceOver、TalkBack、动态字体）、性能（冷启动 ≤ 2 秒、星空 ≥ 55fps）、崩溃监控 | 全部 | 审计报告 |
| M-15 | 商店素材自动截图、描述文案、隐私标签草稿、EAS 配置、提审清单 | 全部 | 素材包与清单 |

**预计工期**：Codex 连续施工约 3 到 5 天（含返工）。之后需要 Owner 本人完成：在开发者后台建 App 记录与内购产品、在 RevenueCat 与 AdMob 建项目、在 TestFlight 与 Play 内测上试用、点提审。

## 11. 风险

| 风险 | 应对 |
|---|---|
| Apple 以 4.3 重复类别拒审 | 原生实现与独有功能先行；提审说明强调差异；必要时先上 Android 积累评分 |
| 引擎在 Hermes 上的兼容或性能问题 | M-02 第一个验证；必要时把重计算放到后台线程（react-native-worklets） |
| 内购抽成让会员净收入下降 | 永久买断为主；Web 端保留 Stripe 渠道（商店规则允许 Web 单独售卖，只是 App 内不能引导） |
| 小组件与推送的平台差异 | 数据计算全在 JS 层，原生层只负责展示，降低两套代码的差异 |
| 知识库热更新被视为违规改功能 | 只更新文本数据，不更新代码逻辑；在审核备注里说明 |

## 12. 已在 Apple 后台完成的配置（2026-10-06，供施工引用）

| 项 | 值 |
|---|---|
| Team ID | `D33974QQTD` |
| Bundle ID | `pub.gavin.tianji`（已开启 App Groups、Associated Domains、Push Notifications、Sign In with Apple；In-App Purchase 默认开启） |
| App Group | `group.pub.gavin.tianji`（已关联到主 App ID；小组件扩展的 App ID 由 EAS 在首次构建时创建，并需加入同一 App Group） |
| App Store Connect App | 名称 `DestinyOS: BaZi & Tarot`，Apple ID `6819614010`，SKU `destinyos-ios`，主语言英语（美国） |
| 非消耗型内购 | `tianji_pro_lifetime`，Apple ID `6819614424`，6.99 美元，174 个地区（不含中国大陆），en / 简中 / 繁中显示名已填，家人共享关闭 |
| 订阅群组 | `DestinyOS Pro`，群组 ID `22444860`，显示名 en「DestinyOS Pro」/ 简中「天机会员」/ 繁中「天機會員」 |
| 自动续期订阅 | `tianji_pro_monthly`，Apple ID `6819616346`，1 个月，2.99 美元，174 个地区，en / 简中 / 繁中显示名已填 |
| 待补 | 两个内购的审核截图（App 做出后补）；App 的中文本地化名称与商店文案（M-15 产出后填写）；首个内购需随 App 首版一起提交审核 |
