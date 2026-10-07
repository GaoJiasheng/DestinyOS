# App M11：推送与小组件

## 完成项

- 默认开启每日/特殊日提醒，默认本地 08:00；原生时间选择、独立开关与主题设置。
- 引导第二屏自动请求权限；拒绝后今日页提示可关闭，返回前台重新读取系统权限。
- 未来 7 次每日通知滚动替换；有档案用共享引擎运势，无档案用 30 条 zh/zh-TW/en 引导结合公共天象。
- 节气、新/满月、水逆起止、八字/紫微大运及流年交接；点击进入 /today 或 /me/birth。
- iOS WidgetKit 小/中/大及圆形/矩形锁屏；Android 2×2/4×2/4×4 与本地 Expo 存储模块。
- JS 计算，原生只读；8 天午夜时间线、过期提示、切换身份清理；不共享出生资料和账号标识。
- App Group group.pub.gavin.tianji，主包 pub.gavin.tianji，扩展 pub.gavin.tianji.widget。
- 启动/前台/设置/档案/语言变化刷新；注册离线后台任务；保留无关运营通知。
- Maestro 实际本地通知送达、两条跳转、设置保存、后台函数成功、三语设置截图及五种原生小组件展示。

## 未完成项（环境限定）

- Android 原生构建、安装、三尺寸截图、重启/节电/后台送达：待 Owner 安装 Java；本次未安装 Java、未进行 Android 原生构建。
- iOS 真机 BGTaskScheduler 调度、锁定后的 SQLCipher、重启与长期后台刷新；模拟器不支持后台系统调度。

## DESIGN-GAP 列表

- 设置使用 /me/settings/notifications 子页，复用既有字段及枚举。
- 版本化展示白名单；引擎文案键沿用内容 QA 的校验契约。
- 特殊日同日合并并使用用户提醒时间；排程部分失败回滚后允许重试。
- 前台分钟轮询检测日期/时区；后台最小 60 分钟为系统提示，午夜时间线覆盖延迟。
- Android SharedPreferences 使用小型本地 Expo 模块；4×2 五维使用紧凑双栏。
- 原生图库/空态及 Android 启动器标签由 next-intl 生成三语资源。
- WidgetKit 使用共享 RWS 图片生成 PNG 缩略图；扩展使用惯例 .widget 后缀。
- Hermes 国际化 polyfill 先于引擎初始化；不修改共享算法。
- 模拟器直接调用同一后台函数并验证 Success；不声称系统实际调度。
- 验收关闭 Fast Refresh；合成档案每轮新 ID，避免恢复删除墓碑。
- Maestro 限定已有运行时 PATH，避免无关 Flutter 探测阻塞；原生图库/锁屏坐标针对 iPhone 17 Pro / iOS 26.4。

## 如何验证

- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build 均通过。
- Vitest：134 文件、3712 测试通过（1 文件/2 测试既有跳过）；App Jest/RNTL：36 套、172 测试通过。
- pnpm i18n:check、pnpm licenses:check 通过；新增依赖无 AGPL/GPL。
- Android expo prebuild --platform android --no-install 与 autolinking、三个 provider/尺寸/语言资源静态检查通过。
- iOS prebuild、Xcode 26.4.1 本地 ad-hoc 模拟器构建通过；App Group 实际读取 8 天白名单数据。
- iPhone 17 Pro / iOS 26.4 专用模拟器；脚本 scripts/m11-simulator.sh、scripts/m11-widget-gallery.sh（apps/mobile 下）。
- 截图与验证元数据：apps/mobile/test-results/M11/；用 Maestro M11.yaml、M11-locales.yaml、M11-widget-gallery.yaml、M11-lock-widgets.yaml 复验。
