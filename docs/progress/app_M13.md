# App M13：内购、广告与同意管理

## 完成项

- `/pricing`、`/me/billing` 原生会员页；我/设置入口，zh/en 与自动生成 zh-TW，共享 next-intl 文案和字体子集。
- RevenueCat 使用已登录 Web `User.id`；两个精确产品：月订阅 `tianji_pro_monthly`（US$2.99）、非消耗型 `tianji_pro_lifetime`（US$6.99），统一 `pro`。
- 商店本地价格、购买、恢复、取消/失败/处理中状态、系统订阅管理；永久会员仍可管理未取消的月订阅。
- 登录/切换账户/前台/手动刷新权益；SDK 监听退款/过期，空请求体调用既有鉴权权益同步接口。
- 权益合并保留永久/跨端/历史 Stripe 权益；同步失败可重试；不向服务端提交客户端或模拟权益。
- 每日运势一个、报告章节间最多两个 Google 原生测试广告位；会员/年龄/同意变化立即销毁广告，迟到加载自行销毁。
- UMP → iOS ATT → 广告初始化；拒绝跟踪/个性化用 NPA，13–17/未知年龄 TFUA+NPA，<13 或同意失败不请求广告。
- 隐私选项重开/重试、Do not sell or share 入口，三语言 ATT 系统说明，延迟广告衡量初始化。
- 明确 __DEV__ 本地测试页面、隔离模拟账号/购买/UMP，不收费、不产生真实网站会员；同时支持项目 Test Store public key。
- 依赖许可证检查通过；Bundle ID/包名 `pub.gavin.tianji`、App Group `group.pub.gavin.tianji` 不变。

## 未完成 / 待验

- Android 原生构建、系统广告/UMP/Play 购买、小组件运行与 Maestro：遵照 Owner 要求，待安装 Java 后验收；未安装 Java。
- RevenueCat 项目 Test Store/Apple/Google 沙盒及真实跨端 webhook 联调：本机未提供项目 SDK/server key，本次购买验收使用隔离本地测试适配器。
- 地区 UMP 表单及撤回流程待配置 Privacy & messaging；已验 Google sample UMP 跟踪说明和真实 iOS ATT 拒绝，配置失败关闭广告。
- 真机商店订阅管理页面、TestFlight/Play 内测及真实退款/宽限周期仍需上述后台配置；本次测试不冒充真实沙盒交易。

## DESIGN-GAP

- 直接按精确产品 ID 获取商店产品，不假定文档未给出的 Offering ID；Google base-plan 后缀只用于匹配产品。
- 沿用 M09 权益响应，通过共享 api-client 类型安全传输，未改共享包行为。
- 所有 M13 广告固定 Google sample app ID / TestIds.NATIVE；生产广告配置留待后续发布。
- 自身/历史档案采用最严格年龄，亲友档案不改变设备用户广告年龄；未知年龄保守采用 TFUA+NPA。
- v17.2 Android 原生年龄枚举大小写不一致，保留 SDK 支持的 TFUA 兼容标记。
- 同意网络失败关闭广告；无填充/加载失败折叠广告卡，不自动刷新或伪造广告。
- 每分钟检查缓存过期，前台刷新 SDK/Worker；新验证宽限权益保留五分钟，以 RevenueCat requestDate 限制离线旧缓存续期。
- 历史 Stripe 无 RevenueCat 到期日时保留已验证 server plan，直到下一次权威刷新。
- ATT 提示由共享目录生成原生三语言资源；测试适配器仅可在 __DEV__ 显式启用。
- Maestro 使用既有 JVM 与独立 iOS 模拟器，不安装 Android Java。
- Fabric 原生广告容器不加 padding，改在内部 View 布局，保证广告资产边界及 AdChoices；Google 校验器通过。
- 显式开发测试接管同意转换，档案重载不取消 ATT；Maestro 禁止预授予跟踪权限，验证真实系统提示。
- 商店暂不可用时显示通用重试提示，SDK 配置说明只放开发 README。
- RevenueCat 管理 sheet 仅 iOS 可用；Android 使用官方 Play 订阅中心链接，支持永久/免费用户取消既有月订阅。
- HTTP 200 不等于跨端权益到账：服务端仍免费/缺永久标记时保留同步提示，重试至所购档位确认。

## 如何验证

- 根目录必跑命令：`pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过；Vitest 136 文件/3722 项（既有 1 文件/2 项跳过），Jest 45 文件/233 项。
- Jest/RNTL：购买/恢复、账户隔离、同步失败、退款/宽限/旧缓存、NPA/TFUA、广告销毁、同意顺序、三语言页面。
- iOS 原生编译和 Maestro：M13-billing、M13-ads、M13-placements 全通过；28 张截图及 `verification.json` 在 `apps/mobile/test-results/M13/`。
- Android `expo prebuild --platform android --no-install` 成功；静态核对广告 ID、延迟初始化、三种小组件接收器与包名。
- `pnpm licenses:check`（1755 包）、`pnpm i18n:check`、字体子集与覆盖检查通过。
- 复现：Metro 8081 + 原生 dev client，`bash apps/mobile/scripts/m13-simulator.sh <UDID> M13-billing` / `M13-ads` / `M13-placements`。
- 项目测试配置见 `apps/mobile/README.md`；[RevenueCat Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store) 需要该项目的 `test_` public SDK key，没有通用测试 key。
- 未提交 `.env`、凭证或原生生成工程；既有非 M13 改动保留，不修改 `.codex-runs/`。
