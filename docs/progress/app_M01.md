# App M01：脚手架

## 完成项
- `apps/mobile`：Expo SDK 57.0.27、Expo Router、React Native 0.86.3 新架构、TypeScript strict。
- workspace 依赖 shared / engine / interpret / content / ui-core；业务包复用，不复制算法。
- docs/03 token 抽至 `packages/ui-core/tokens`；生成 Web CSS，保留原外观与字体角色。
- 内嵌五套 OFL 字体子集，共 226,236 字节；校验简中、繁中与英文壳层字符覆盖。
- 品牌首屏、今日 / 推算 / 问 / 学习 / 我五 Tab 空页面；中央问入口突出。
- 东方 / 西方 / 吠陀主题与自动模式；语言、主题选择持久化。
- i18next + ICU 直接读取 Web 编译出的 zh / zh-TW / en，同键同文案。
- Bundle ID / Android 包名 `pub.gavin.tianji`；App Group `group.pub.gavin.tianji`。
- 配置 Apple Team、关联域、EAS 构建档位；未提交证书、密钥或环境文件。
- Jest + RNTL 壳层测试、Maestro 导航 / 主题 / 语言流程及 12 张 iOS 截图。
- Web 语言审计修正：部署邮箱与 docs/00 的 Owner 姓名按标识符保留，继续审计其余文案。

## 未完成项
- M01 功能无缺项；完整业务页面、Skia 特效和小组件按 M02–M15 施工。
- Android 原生构建、模拟器截图待 Owner 启用 Java 后验收；本次未安装 Java、未原生构建。

## DESIGN-GAP
- 从纯常量构建 CSS；Web 桌面沿用 768px 断点，避免迁移改变布局。
- 品牌轨道、星点和 Tab 图符尺寸进入共享常量；M01 静态星空，M02 实现 Skia 效果。
- reading / ask 作为原生 Tab 容器路由；M05 实现问的半屏 Sheet。
- 原生主题、语言用可换行 radio 控件，选中边框显示当前 accent。
- AsyncStorage 仅保存非敏感界面偏好；出生资料加密由 M04 负责。
- 原生字体采用 Web 同源 TTF / OTF 子集，派生字体更名并保留 OFL 文本。
- docs/09 的 TypeScript 5.9 保留，排除 Expo 建议的 TS6 版本升级检查。
- 开发深链采用品牌 scheme `tianji`；正式认证保留文档 HTTPS Universal Links。
- Metro / Babel / Jest 配置使用工具标准 CommonJS，例外仅限配置文件。
- Expo 间接依赖 node-forge 的双许可证明确仅选择 BSD-3-Clause，精确版本审计放行。
- 部署联系邮箱与文档明确的 Owner 名称不翻译，语言审计只豁免这些标识符。

## 如何验证
- 实际执行并通过 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- `pnpm test`：120 文件、3650 通过、1 原有跳过；App Jest/RNTL 4 项通过。
- Web 全套端到端回归：22 组、296 项全部通过；M5 语言审计修正后完整重跑。
- 最新产物追加七套报告 × zh/en 的 2 项视觉基线、键盘与 axe 检查，全部通过。
- `pnpm licenses:check`：1661 包通过；`pnpm i18n:check`、Expo 依赖版本检查通过。
- iOS 26.4 / iPhone 17e：Release 原生构建成功，离线品牌页与 Maestro 全流程通过。
- 截图：`apps/mobile/test-results/M01/brand-zh.png`、`brand-en.png` 及 Tab / 主题 / 语言截图。
- 复现：`pnpm --filter @tianji/mobile exec expo run:ios --configuration Release --device <UUID> --no-bundler`。
- 原生流程：`pnpm --filter @tianji/mobile test:e2e --device <UUID>`；需已安装 Maestro。
- Android：`pnpm --filter @tianji/mobile prebuild:android` 成功；静态核对包名、新架构、Hermes。
- Web token 对照：375 / 1440px × zh / en × 四主题，16 组各 209 个变量完全一致。
