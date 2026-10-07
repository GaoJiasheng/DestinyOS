# 天机 · DestinyOS

面向海外华人的中英双语命理平台，域名 `tianji.gavin.pub`。`docs/` 是唯一需求来源。
八体系、合盘与每日运势使用确定性排盘、结构化知识库；可选 AI 追问独立开关，默认关闭。Next.js 15、React 19、TypeScript strict、next-intl、Prisma 6.19.3 + D1/本地 SQLite、KV 与 Cloudflare Workers/OpenNext；架构以 docs/09 的 CF-NATIVE 补充为准。

T-64 正在按当前 Web + App 实现复验。Vercel CLI 62.7.0 实测未登录，尚无 Preview；OAuth/AdSense、生产密钥、内容人工审稿和 CSP enforce 保留独立发布门槛。最终验收记录见 [T-64](docs/progress/T-64.md)。
zh/en/zh-TW、多档案、合盘、日历、辅助定盘、PDF/PNG 导出、可选 AI 追问、公共长文/FAQ/SEO 和加密日记均已合入。完整任务状态与已知问题见 [进度汇总](docs/progress/SUMMARY.md)，部署和环境变量见 [LAUNCH.md](LAUNCH.md)，今早执行顺序、逐项 secrets 命令和验证方法见 [MORNING.md](MORNING.md)。

## 本地运行

需要 Node.js 22.17+（建议 22 LTS）、pnpm 9.15.9。无需 PostgreSQL/Redis Docker 服务。

```bash
pnpm install
cp .env.example apps/web/.env.local
# 填本地 AUTH_SECRET / FIELD_ENCRYPTION_KEYS；origin 改为 http://localhost:3000
pnpm db:deploy
pnpm db:migrate
pnpm content:import
pnpm dev
```

Next.js 读取 `apps/web/.env.local`；根 CLI 需要环境时用 `node --env-file=apps/web/.env.local --run <script>` 单独注入。
`db:deploy` 与 `content:import` 默认只操作本地 SQLite；远端 D1 使用 `pnpm db:remote`，按 LAUNCH.md 完成生产内容发布。
匿名排盘/解读无需服务凭据，出生档案留在本机 AES-GCM 存储。现版本不能直接使用旧 PostgreSQL migration lock 执行 `prisma migrate deploy`。

- `/zh`、`/en`、`/zh-TW`：首页；无前缀按 cookie、Accept-Language、默认 zh 协商。
- `/[locale]/today`：每日运势；八体系与合盘入口使用文档规定的 system 枚举；日历、辅助定盘已实现。
- `/[locale]/me`：档案、历史、设置、导出删除与订阅。
- `/[locale]/learn`：体系、78 张塔罗、64 卦和术语百科。
- `/admin`：管理员后台，需白名单、数据库角色及近期重新认证。

## 检查与验收

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm i18n:check
pnpm build
pnpm exec playwright install chromium
pnpm launch:check --full
pnpm cf:build
```

`launch:check --full` 实际执行 `pnpm test:e2e` 与 `pnpm perf:ci`。E2E 自动启动本地 dev server 和隔离 SQLite/邮件/签名 Stripe 测试服务；无需真实付款密钥；完整链显式执行 `test:polish` 及新增功能套件，覆盖七体系及六爻、生命灵数、合盘、双语、广告和触屏。
`perf:ci` 先检查首页首屏 180KiB 和懒加载 Three.js 220KiB 的 gzip 预算。Lighthouse 先验证中英双语每日页真实内容与离线计算，再使用生产构建审计首页、today、八字完整报告、合盘与日历各 3 次，移动端最差 Performance ≥85、Accessibility ≥90。
Lighthouse 本次复验结果写入 T-64 与进度汇总；阈值为每页三次最差 Performance ≥85、Accessibility ≥90。
并行工作区运行完整验收时使用 `CI=true TEST_M5_PORT_OFFSET=1000 pnpm launch:check --full --app`；M5、POLISH、导出的网页/邮件/Stripe mock 端口按同一偏移隔离，默认偏移为 0；服务已占用时直接失败，避免误用别的工作区。
不要并发运行 Web dev、build、Cloudflare 构建和性能审计，它们共用 `apps/web/.next`；App Maestro/Metro 同样应等共享 content:build 完成后再启动；截图和性能结果分别在 `test-results/`、`.lighthouseci/reports/`。`test:cloudflare:e2e` 使用独立 Wrangler 8787 服务：先 `pnpm cf:build`，一个终端运行 `pnpm cf:smoke`，另一个终端运行 `pnpm test:cloudflare:e2e`，完成后停止本地 smoke；不混入 Node dev-server 套件。

`pnpm launch:check` 是快速质量/隐私/部署产物探针，浏览器项会显示未验证；JSON 记录在 `.launch-check/results.json`，包含运行时间、Node 版本、模式和本地/外部门槛分类；Fixture A 八体系及 A/B 合盘的 18 份双语报告保存在 `.launch-check/reports/`。
`pnpm launch:check --full --release` 还将未完成的外部发布门槛计为失败，不能把本地通过等同于公开上线。

附加命令：`pnpm licenses:check`、`pnpm security:policy`、`pnpm audit`、`pnpm perf:budgets`、`pnpm engine:bundle`。
依赖 audit 例外与安全补丁依据见 [合规操作说明](scripts/compliance/README.md)；不引入 GPL/AGPL 依赖。

## 内容与目录

- `apps/web`：响应式界面、认证、账户、分享、支付、广告、百科与后台。
- `packages/engine`：八体系、合盘、辅助定盘及 daily 纯 TypeScript 排盘，黄金 fixtures 与浏览器验证。
- `packages/interpret`：知识命中、组合、术语与可读性，不依赖数据库或网络。
- `packages/content`：双语 YAML、schema、校验、编译；3826 KU、627 术语、27 篇双语公共长文。
- `packages/shared`：品牌单一配置、枚举、schema；`packages/config`：严格 TS、ESLint、设计 token。
- `prisma`：模型、版本化迁移、加密扩展；`scripts`：数据资源、内容导入、性能、安全与上线检查。

`worker:build` 生成带内容哈希和 Brotli 的匿名每日 Worker；zh/en 使用精简包，zh-TW 按需使用带繁体字典的包。web dev/build 自动生成，根 build 在 Turbo 缓存恢复前保证资源存在；三种语言的实际压缩产物均执行一致性测试。

`content:import` 校验编译后原子导入 KU/不可变 Release，可安全重复；冲突拒绝覆盖，需增加单元与 Release 版本。
旧报告保留生成时版本；新报告使用已发布数据库 Release，数据库不可用时回退构建知识库。
[DESIGN-GAP 索引](DESIGN-GAPS.md) 汇总代码中的未规定细节；内容相似度警告和人工审核状态保留可见。

## App

`apps/mobile` 是 Expo SDK 57 / React Native 原生 App；共享排盘、解读、next-intl zh/en/zh-TW 文案、几何布局与类型安全 API 客户端。M-01–M-15 的实现与平台待验项见 [任务汇总](docs/progress/SUMMARY.md)，商店素材、环境变量、RevenueCat/AdMob 和提审步骤见 [App 发布手册](docs/app/RELEASE.md)。

支持加密 SQLCipher 离线档案/报告/日记、八体系与合盘、手势塔罗/摇卦、今日/日历、登录同步、设备撤销、推送、小组件、分享导出与可选追问。购买仅去广告：USD 2.99/月、USD 6.99 永久；Web 支付默认关闭。真实商店沙盒、真机、签名和提审须由 Owner 完成。

```bash
pnpm --filter @tianji/mobile exec expo start --lan --port 8081
# 另一终端：M12 loopback fixture server（导出文件由 Web export E2E 生成）
node apps/mobile/scripts/m12-server.mjs
# 专用且已安装开发包的 iPhone 17 Pro 模拟器；不得指向含真实用户数据的设备
MAESTRO_DEVICE=<UDID> MAESTRO_AUDIT_DEVICE=<Release审计UDID> MAESTRO_IPHONE_69=<6.9寸UDID> MAESTRO_IPHONE_65=<6.5寸UDID> \
  pnpm --filter @tianji/mobile test:e2e
pnpm --filter @tianji/mobile store:assets
```

App `test:e2e` 逐个运行全部 Maestro YAML（含两个尺寸的三语商店截图），M02/M04 使用原生帧采样/SQLCipher检查；全部流程通过后再独立测五次 Release 冷启动和六个帧率窗口。M02 视频验证需要本机 `ffprobe`；已有 `ffmpeg` 时自动压缩交付视频，原始录屏留在本地证据目录。失败返回非零，本地结果在 `apps/mobile/test-results/launch/results.json`，四张原生 Skia 输出随流程自动捕获并校验；全部通过后最终凭据自动归档到 `apps/mobile/test-results/M15/launch-verification.json`，基线在各 Mxx 目录。可在命令后指定单个流程名定位故障；部分运行明确标为不完整，不能当作总验收。
本轮 iOS 原生 Release 构建与全部 36 个 Maestro 流程通过；290 张当前基线、四张 Skia 原图与 36 张商店素材完成核验。冷启动最慢 1682.4ms；六个连续窗口均约 60fps，P95/最慢帧 16.67ms。Android 原生按任务要求待 Owner 安装 Java/SDK。
M14 保留文档规定的冷启动 ≤2s、星空 ≥55fps；列表采用明确标注的 DESIGN-GAP：≥55fps、P95 ≤20ms、最慢帧 ≤50ms，所有 >25ms 间隔仍留档，真机性能另行验收。
`pnpm launch:check --app` 核对全部 App 流程、当前截图/原生分享输出哈希和计算/帧率/冷启动预算；`--resume` 仅复用源码与 YAML 未变的通过记录，保留原始时间和证据路径，并在重置通知档案时重新建立桌面与锁屏小组件。
iOS 原生 Release 构建单独用 Xcode + CocoaPods 验证；根 `pnpm build` 的 Expo export 不能替代原生构建。Android 原生构建按任务要求待 Owner 装 Java/SDK 后验收；不以 iOS 截图代替 Android。iPad、VoiceOver/TalkBack、真机性能、TestFlight/Play 一周内测仍是独立门槛。
