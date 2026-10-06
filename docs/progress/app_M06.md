# App M06：报告页与七体系命盘

完成项：
- 原生 `/[system]/r/[id]` 报告路由；SQLCipher 保存中英报告、引擎元数据与输入快照，繁中复用共享转换。
- Headline 雷达入场、置信度、原生折叠章节和固定章节导航；术语弹层、长按复制、依据高亮、建议与原文折叠。
- 专业视图展示流派、版本、完整命盘与知识命中；反馈离线保存，删除报告/个人数据时清除。
- 八字四柱/五行环/强弱/大运；紫微十二宫和三方四正；周易本变互卦与动爻；奇门九宫及朝向切换。
- 塔罗复用 78 张公版牌图与八类牌阵布局；西方轮盘和 3D/Skia 降级；吠陀南北盘、D1/D9 与 Dasha 轴。
- 生命灵数生日矩阵和九年轴；合盘双轮和 Ashtakoot；未知时间不伪造宫位/上升。
- 各盘双指缩放/移动、逆变换点击详情、章节双向联动、可访问数据按钮与重置。
- 推算入口从现有档案生成报告；合盘只选已有档案；快速塔罗/梅花报告为 M07 仪式接入预留。
- 全部新增文案经 next-intl，zh/en 同步；字体涵盖知识库汉字，图形/算法/内容复用 packages。

未完成项 / 待验：
- Android 原生构建、模拟器截图与交互验收：按 Owner 要求等待 Java，不安装 Java、不执行 Android 原生构建。
- 3D 天球真机性能与实际 GL 呈现需设备验收；iOS 模拟器验证 Skia 降级。
- M07 洗切选牌/摇卦仪式、M09 后端、M10 账号同步、M12 分享属于后续任务。

本次 DESIGN-GAP：
- 动态 Zod 分派在各 schema 校验后恢复判别联合；仅缺失语种的旧快照补存解释，不重排命盘。
- 快速占卜采用现有引擎默认输入；反馈仅存本地加密表，后续同步需明确契约。
- 快照增加可选共享 EngineMeta，以保留警告、流派降级与专业调试信息。
- 整体分布/模式依据高亮全盘；技术字段无文案键时以原 schema 名经 report.content 展示。
- 八字强弱标尺使用 -6..6 显示范围、紧凑数值保留一位小数；生命灵数采用文档常规 3/6/9、2/5/8、1/4/7 朝向。
- 专业视图切换后定位新面板；原生字体覆盖打包知识库汉字，OFL 符号子集复用共享行星/星座符号；iOS RNCore 缓存缺少 Debug 符号，改为官方 source-build 配置。

验证方式：
- 根目录实际执行 pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build。
- Web/共享 Vitest：128 套件、3697 项通过（仓库原有 1 套件/2 项跳过）；移动 Jest/RNTL：15 套件、98 项通过。
- 新增测试覆盖九体系真实快照、八类牌阵、证据解析、缩放逆变换、未知时间、双语回放、反馈生命周期和原生状态。
- pnpm licenses:check：1710 个依赖通过，无新增 GPL/AGPL。
- expo prebuild --platform android --no-install 通过；生成工程核对 pub.gavin.tianji 与 newArchEnabled=true。
- Maestro 四个流程通过，20 张截图覆盖命盘、术语/复制/依据/反馈/专业视图/3D 降级。
- iOS 源码构建通过；iPhone 17e / iOS 26.4，Maestro 脚本 apps/mobile/scripts/m06-simulator.sh。
- 确定性 Fixture A/B、seed fixture-A、时间 2026-10-04；截图和验收元数据见 apps/mobile/test-results/M06/。
- 重放脚本第二参数可选 M06、M06-vedic、M06-numerology、M06-interactions；先按脚本注释启动 Metro。
