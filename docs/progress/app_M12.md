# App M12：追问大师、导出、分享、合盘与多档案

## 完成项

- 原生 `/r/[id]/chat`：增量 NDJSON、历史、配额、取消、失败重试、确认删除；离线禁用入口并提示。
- AI 生成标识与举报联系页；更换报告、语言或账户清空未发送问题，账户边界中止旧请求。
- PDF / A4 PNG / 封面调用现有 Web 导出；原生系统分享与分页面下载，结束后清除缓存明文。
- Skia 离屏分享卡：1080×1920、1200×630、二维码、结论/关键词/矢量星级与派生图；显式选择公开级别。
- 分享链接复用 Web 公开投影；鉴权令牌只进 Header，出生字段、私有报告 ID 不进分享卡或举报 URL。
- 合盘选择两个不同已有档案、A/B 交换、未知时间提示、离线计算与原生报告。
- 档案关系、默认档案、切换、历史；历史包含合盘双方，删除任一方清除合盘私密快照。
- 默认档案同步不改变出生版本；匿名免费档案上限 3，账户配额由现有服务端校验。
- zh/en 同步文案及自动生成 zh-TW；App 字体子集补字；共享 API、公开投影复用 packages/*。
- Web 回归发现聊天发送后的焦点时序问题；改为 DOM 提交后恢复，并覆盖三语言、主动移焦及配额耗尽。
- Jest/RNTL、Web/API 回归、Maestro 流程与 iOS 截图，详见 `apps/mobile/test-results/M12/acceptance.json`。

## 未完成 / 待验

- Android 原生构建、真实系统分享及模拟器 Maestro：待 Owner 安装 Java；已完成 TS、单测、双平台 JS 导出和 Android prebuild 静态校验。
- 真实账户/线上 LLM/线上分享链接的设备联调仍需上线环境；本次 Maestro 使用隔离合成档案和本机 HTTP 流式响应。

## DESIGN-GAP

- 原生二进制/流式鉴权使用 Expo fetch；初始连接状态未知时暂禁云操作。
- NDJSON 上限 256 KiB，必须收到 done；原生导出单文件缓存上限 8 MiB。
- 未定义举报 API：使用既有联系页，由用户自行反馈，不自动传聊天内容。
- 紧凑海报仅接收共享白名单派生图；完整公开正文通过 level 2 链接阅读。
- 固定海报格内的过长译名省略；模板内部 ID `chart/quote/daily` 复用既有 Web 实现。
- 离线二维码指向对应语言的公共 Today 页，避免泄漏私有报告标识。
- 默认选择只更新时间、不更新出生版本；删除默认档案选最早存续档案。
- 异步档案操作绑定发起账户；切换账户先清空旧投影，再加载新账户数据。
- 匿名档案采用免费上限；登录配额保持服务端权威。
- 新增聊天 GET/DELETE 复用 Web 所有权、配额、密文保存与删除规则。
- Web 聊天焦点恢复等 React 启用输入框后执行，避免动画帧早于界面提交。
- Maestro 使用仅 __DEV__ 可用的本机传输、稳定合成 ID 和现有 JVM；导出文件来自 Web 导出验收产物。

## 如何验证

- 根目录 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 均通过。
- Vitest：136 套件、3722 项通过（既有 1 套件 / 2 项跳过）；Jest/RNTL：40 套件、195 项通过。
- 默认 Web 端到端 302 项逐项通过；polish 首轮 35 项通过，修复焦点后再通过 6 组三语言/双宽度键盘流程。
- iOS 原生编译及 6 个 M12 Maestro 流程通过；截图与两种尺寸 Skia 原图保存于 `apps/mobile/test-results/M12/`。
- Android prebuild、许可证检查、i18n 检查和 Web 字体覆盖检查通过。
- 复现：先执行 `pnpm test:export:e2e` 生成 Web A4 产物，再运行 `node apps/mobile/scripts/m12-server.mjs`。
- 启动 Expo dev client：`CI=1 pnpm --filter @tianji/mobile exec expo start --lan --port 8081`。
- `bash apps/mobile/scripts/m12-simulator.sh <iOS-UDID> <流程>`；流程：M12、M12-export、M12-profiles、M12-share、M12-chat-zh、M12-diagrams。
- Bundle ID/包名 `pub.gavin.tianji`、App Group `group.pub.gavin.tianji` 保持与 §12 一致；未提交凭证或原生生成工程。
