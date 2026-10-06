# APP-M02 — Hermes 与特效样机

## 完成项

- Expo 57.0.27 / RN 0.86.3 / Hermes V1，`/dev/effects` 六项样机；Bundle ID `pub.gavin.tianji`，新架构。
- 七体系及完整 `computeDaily` 使用共享生产算法与知识包；zh/en 各四次，共 64 次设备内计算。完整盘面比对 Node 基准（数字容差 1e-5），报告命中、章节、长度与可读性校验。
- Hermes 实测 Intl 纽约夏令时、中文/emoji TextEncoder；crypto 缺省时共享纯 JS SHA-256 仍可重现种子，无额外全局 polyfill。
- 优化英文术语正则边界、节气去重与 Panchang 同次采样；保持所有 Fixture A 盘面与报告基准不变。
- Skia Atlas 共 9096 颗 BSC5 星、共享星等/B−V 配色及天顶/行星计算、±3° 陀螺仪视差、流星；低电量/减少动态/后台停止动画。
- r3f native + expo-gl 共享天球几何，拖拽旋转；80 粒子三种预设；塔罗透视翻转与逆位旋转；三铜钱弹跳与触感；占星轮盘行星/相位入场。
- 新文案用 next-intl，zh/en/zh-TW 同步；原生字体增补样机汉字与行星标签；Web 使用同一共享星表/天球几何。

## iOS 测量

- iPhone 17e 模拟器 / iOS 26.4 / Xcode 26.4.1 (17E202) / Apple M5 Max，Release 包；这些结果不代表中端真机。
- 每场预热 2 秒、采样 10 秒；Maestro 在采样结束前只通过 localhost 读取原生 JSON，避免 XCTest 层级轮询扰动。
- 帧率来自 UI display-link 调度（3D 可用时另测 r3f render 回调），不是 GPU 完成率；阈值按未四舍五入的值判断，仅容忍 1e-6 浮点误差。

| 场景 | 目标 fps | 实测 fps | 模式 / P95 |
| --- | ---: | ---: | --- |
| 星空 | 55 | 60.00 | Skia / 16.67ms |
| 天球 | 45 | 60.00 | Skia 2D 降级 / 16.67ms |
| 80 粒子 | 60 | 60.00 | Skia / 16.67ms |
| 塔罗翻牌 | 60 | 60.00 | Reanimated + Skia / 16.67ms |
| 铜钱落下 | 60 | 60.00 | Reanimated / 16.67ms |
| 占星轮盘 | 60 | 60.00 | Skia / 16.67ms |

- GL 单采样离屏探针读出 388 个可见像素、错误码均为 0；模拟器屏幕 GL 层仍空白，故明确降级，不把空白层回调计作 3D 达标。
- 引擎最大耗时（含 compute+interpret；Daily 包含三份本命盘前置）：

| 体系 | zh ms | en ms |
| --- | ---: | ---: |
| bazi | 104.04 | 94.38 |
| ziwei | 88.54 | 84.79 |
| iching | 33.33 | 26.13 |
| qimen | 52.17 | 52.00 |
| tarot | 24.27 | 22.96 |
| astrology | 83.73 | 80.71 |
| vedic | 88.02 | 77.17 |
| daily | 117.48 | 121.50 |

- 录屏、zh/en 截图与原始 JSON：`apps/mobile/test-results/M02/`；`run-metadata.json` 记录环境和录屏校验和。

## DESIGN-GAP 列表

- `lib/diagnostics/{engine-check,fixture,frames}.ts`：Daily 计入全部前置；首轮与四次中的最大值；2+10 秒调度采样，降级后重新采样，与 GPU 完成分开。
- `scripts/{frame-wait.py,m02-simulator.sh}`：localhost 等待设备 JSON，模拟器 UUID 隔离其他已启动设备。
- `app/dev/effects.tsx`、`components/effects/starfield.tsx`：内部开发路由仅公开 Fixture A，北京替代敏感定位；墨滴使用 token 奶油色纸面。
- `components/effects/{starfield,particles,rituals}.tsx`：离屏纹理转换 CPU-backed 后上传；样机固定舞台尺寸。
- `components/effects/sphere.tsx`：离屏单采样验证 GL 输出，规避 iOS MSAA 读取错误；本机 iOS 模拟器显式 2D 降级，真机保留 GL。
- `packages/interpret/src/terms.ts`、`packages/engine/src/{common/divination,astrology/panchang}.ts`：正则等价提取边界、Set 去重、单次调用内共享精确采样，不持久缓存结果。
- `scripts/font-subsets.py`：同来源 OFL TTF 子集；`playwright.config.ts` 隔离无付费模式；`apps/web/next.config.ts` 按公开编译配置隔离构建缓存。

## 验证与未完成项

- `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 均通过：Vitest 3674 项（既有 2 项跳过）、移动端 Jest/RNTL 24 项；根脚本全部 Web E2E 套件共 302 项通过（polish 32 项 + 缓存修复后 4 项复测）。
- `pnpm licenses:check`：1695 个依赖通过；`pnpm fonts:check` 与 `pnpm perf:budgets` 通过；Android `expo prebuild --platform android --no-install` 成功，包名与新架构静态校验通过。
- `bash apps/mobile/scripts/m02-simulator.sh` 与 `maestro --device <UUID> test apps/mobile/maestro/M02-en.yaml` 通过：16 张中英文截图、124.63 秒 simctl 录屏，六项原始预算断言通过。
- 本次按 Owner 约束未安装 Java、未做 Android 原生构建；待安装后验收 Hermes、六项帧率/录屏、陀螺仪、触感及 3D/降级。
- 待真机验收：iOS/中端 Android 的 GL 屏幕输出与 ≥45fps、真实陀螺仪/触感、低电量、减少动态、动态字体及 GPU/热量/功耗；模拟器无法替代。
