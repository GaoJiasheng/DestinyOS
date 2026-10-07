# APP-M14 无障碍、性能与监控审计

依据：`docs/00-overview.md`、App 方案 §0/§2/§3/§4/§10 M14/§12、架构与隐私规则。2026-10-07。

## 完成项

- VoiceOver/TalkBack 语义：标题、标签、按钮/单选状态、禁用状态、输入框；页面和模态标题读屏焦点、状态播报；装饰图形退出读屏树。
- 系统读屏或大字体时图表切换原生数据表；日历/日记改可伸缩日期列表；原生选择器字号和高度随字体缩放，操作区允许换行。
- 系统与应用减少动态效果控制导航和模态；读屏、低电量、后台停止装饰运动；引导页离开星空步骤即停止绘制动画。
- 历史与百科索引改虚拟列表，保留全部数据、检索与导航；缓存 next-intl 翻译器、星空天文输入，首屏不预热离线知识库。
- 接入 Sentry RN、Expo/Metro 符号与 source-map 插件；关闭 PII、自动网络/交互面包屑、日志、截图、视图树和 tracing。
- JS 事件只保留技术栈与有限命名数值指标，删除生日/坐标/提问/邮箱/凭证/请求/局部变量等数据；开发和审计构建不上传。
- zh/en/zh-TW 审计文案共用 next-intl 源目录并重建字体子集；Bundle ID、App Group、产品 ID 沿用 §12。
- Android prebuild 静态校验通过：包名、新架构/Hermes、Sentry Gradle 插件及三种小组件接收器；没有安装 Java 或进行 Android 原生构建。

## 实测与证据

- iPhone 17 Pro / iOS 26.4 模拟器、Release、Hermes、内嵌 bundle、无 Metro；仅使用公共星表和合成记录。
- 冷启动五次：退出后冷却 2 秒，主机 simctl 调用前至字体/身份/加密档案就绪帧，最慢 **1.560 秒**；首次安装首轮最慢 **1.993 秒**。
- 快速重启与 CI/主机高负载复测出现 2.053–2.443 秒，保留 `cold-start-host-load.json` 和 `cold-start-ci-load.json`，不以 JS 评估时间替代原生启动。
- 最终独立星空三轮：**60fps**，均 ≥55（初轮 59.30–60fps 留存于 `performance-initial.json`）；500 条记录自动滚动三轮：**60fps**，每轮超过 25ms 的长帧 **0**。
- 每轮预热 2 秒、采样 10 秒；保留全部六轮 `performance.json`。Maestro 轮询样本另存，含长帧，不作为独立性能验收结果。
- 中英文星空/列表/滚动、应用减少动态效果截图：`apps/mobile/test-results/M14/`；最大辅助字体 3.571 倍的中英文标题/控件/输入截图通过，`accessibility-large-text-reduced.json` 确认系统减少动态效果为 true。
- UI display-link 只证明调度节奏，不能替代 GPU 完成、真机触摸滚动或中端机 Instruments 验收。

## 未完成 / 待验项

- Owner 安装 Java 后：Android 原生构建、Android 模拟器截图、TalkBack 真实语音/手势、动态字体、运动偏好、冷启动/帧率及小组件运行验收。
- iOS 真机：VoiceOver 真实语音/焦点/手势、GPU/JS 线程 Instruments、包含档案与报告的冷启动、中端机 ≥55fps 与滚动验收。
- 未提供 Sentry DSN/构建凭证：线上错误接收、原生崩溃脱敏和 source-map/dSYM 符号化仍待配置后的端到端验收；本地不伪造上报成功。

## DESIGN-GAP 列表

- 标题焦点交由系统读屏手势；大字体阈值 1.3，图表用完整数据表，日历/日记月视图用全日期行，保留未记录日期的导航，选择器显式缩放。
- 变高列表窗口采用 12/6/5，不设固定 getItemLayout；百科使用单个虚拟索引；Metro 延迟模块求值并缓存翻译器。
- 星空持续低于 55fps 后本次访问静态降级，不反复切换画质。
- 任意错误文本统一替换，避免未标记的出生地/提问泄漏；仅已配置 DSN 的生产构建启用监控。
- 审计路由只在开发/显式审计 Release 开放，使用合成记录与新增双语 mobile.audit.* 文案；场景链接用于断开 UI 轮询后的独立采样。
- 冷启动包括 simctl 开销，退出后冷却 2 秒；独立六个采样窗口、25ms 长帧阈值，明确 UI/GPU 指标差异。
- Sentry CLI 固定经许可审查的 BSD-3-Clause 2.57.0，避免新版 FSL；Maestro 仅复用既有 JVM，不安装 Android Java。

## 如何验证

- 已运行通过：`pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm licenses:check`（1767 个包）。
- 全仓库测试：Web/共享 136 套、3722 项通过（1 套/2 项既有跳过）；Mobile Jest + RNTL 51 套、243 项通过。
- `pnpm --filter @tianji/mobile exec expo prebuild --platform android --no-install`；iOS prebuild、pod install、xcodebuild Release 均成功。
- iOS 构建环境：`EXPO_PUBLIC_M14_AUDIT=true SENTRY_DISABLE_AUTO_UPLOAD=true`；Xcode 参数 `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`，由 Xcode 注入模拟器 Keychain 授权。
- 在 `apps/mobile`：`python3 scripts/m14-cold-start.py <UDID> test-results/M14`；`bash scripts/m14-simulator.sh <UDID>`；Maestro 退出后运行 `python3 scripts/m14-performance.py <UDID> test-results/M14`。
- 最大辅助字体：`xcrun simctl ui <UDID> content_size accessibility-extra-extra-extra-large`，系统减少动态效果开启后运行 `maestro/M14-accessibility.yaml`。
- 无证书、密钥或 .env 入库；不 push，保留用户原有改动，不操作 `.codex-runs/`。
