# app_M05：App 导航、引导、出生表单

## 完成项

- 五个原生 Tab；中央「问」底部弹层及塔罗、梅花、六爻入口。
- 星空、介绍、免责与 18+ 三屏引导；系统通知申请（允许/拒绝）、可选建档、重启免重复引导。
- `/me/birth` 两步原生表单：公历日期选择器、农历真实闰月、13 档时辰、分钟、精确时间、未知时辰禁用。
- 离线 GeoNames 城市库：77,966 条、3,029,430 字节，中文/英文搜索及 CC BY 4.0 署名。
- 手动经纬度/IANA 时区、DST/真太阳时提示、性别、显示名、流派高级选项。
- SQLCipher 多档案新建、修改、切换、删除；重启恢复当前档案；默认列表隐藏生日。
- 共享引擎校验、农历转换、13 岁边界及持久年龄拦截；本次新增文案使用 next-intl，zh/en/zh-TW 同步。
- Maestro 主流程与英文、年龄拦截流程；截图位置 `apps/mobile/test-results/M05/`。

## 未完成项 / 待验

- Android 原生构建、模拟器截图与 Maestro 验收等待 Owner 安装 Java；本次没有安装 Java 或运行 Android 原生构建。
- 报告、占卜仪式、每日内容、学习、通知排程/小组件、追问大师分别由后续 M06–M12 实现；本次交付导航入口。

## DESIGN-GAP

- 城市精简策略：人口 ≥4000，保留最多八个中文别名与英文名，复用 Web 数据源。
- 本地档案 `options.school` 保存高级流派配置；兼容既有档案。
- 加密设置用 `onboardingVersion` 记录引导版本、`ageBlocked` 跨重启保持原生年龄拦截。
- 建档与当前档案选择在同一 SQLCipher 事务内提交。
- 出生年份初始为空；每步重建 ScrollView；时辰整行显示，避免中英文范围截断。
- 同步 iOS Picker 内外层宽高，切换精确时间时重建滚轮组，避免底色越界或默认 216pt 高度压到相邻控件。
- next-intl 内部展平键用下划线处理值/命名空间冲突，源文案键不变；Web 冲突注册表同步。
- Hermes 缺失 Intl.PluralRules，添加 MIT polyfill（en/zh）。
- 开发诊断路由保留开发环境直达；隐藏 Expo 开发浮层以便截图。
- 原生存储失败使用设备中性的重试文案，不引用浏览器设置。
- 模拟器脚本支持 Release 内嵌 bundle 验收；Debug 使用 IPv4 可达的 Metro LAN 服务。
- Maestro 滚动目标居中，避开 iOS 底部安全区的裁切；英文 DST 采用悉尼 1988-01-01 固定样本。

## 如何验证

- `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 均通过；许可证检查通过。
- 全量 Vitest：128 文件/3697 测试通过，既有 1 文件/2 测试跳过；移动端 Jest/RNTL：11 套件/74 测试通过。
- 设备和截图清单见 `apps/mobile/test-results/M05/run-metadata.json`。
- 单测：Jest + RNTL，覆盖通知允许/拒绝、原生日期取消/选择、表单错误/恢复、年龄边界、离线库、多档案保存与切换。
- iOS：iPhone 17e / iOS 26.4；Debug 原生构建、Release 原生构建。
- Release：`pnpm --filter @tianji/mobile exec expo run:ios --configuration Release --device <UUID> --no-bundler --no-install`；由 Expo 完成模拟器签名，Metro 关闭后验收。
- E2E：按顺序运行 `bash apps/mobile/scripts/m05-simulator.sh <UUID> release <flow>`，flow 为 M05、M05-en、M05-age。
- Android 静态验收：`pnpm --filter @tianji/mobile exec expo prebuild --platform android --no-install`。
