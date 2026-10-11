# IOS-INTEGRATE · iOS 上线前前后端合并

## 完成项

- 在 main 合并 deploy，merge commit：2781d05；保留 App/M09/M10 与三 Worker、导出、美术、性能及 Service Worker 修复。
- `/api/v1/mobile/*`（含 RevenueCat）由主入口直接传给 compute，保留方法、查询、Bearer、原始正文与流式响应；统一 `private, no-store`。
- compute 保留 Auth/D1/KV 与移动端业务；维护模式返回原生 JSON，认证和已验签支付回调继续可用。
- App 支持共享 A4 JPEG/紧凑 PDF 导出，保留请求枚举 `png`、files 数组、page=0 与既有下载权限检查。
- 修复离线报告 ChunkLoadError；恢复联网后导入仍可用。登录提交不再被无关启动 Action 卡住。
- 修复分享卡 OCR 阅读顺序及首页戊日原始文案键，复用共享干支枚举并覆盖 60 天中英文周期。
- 修复延迟加载的空通知容器导致 PDF 前置空白页；深浅主题均有实际 PDF 页数与正文回归。
- 修复移动导出/知识库下载异步错误的 API envelope；OS 分享按 JPEG/PDF/旧 PNG 类型发送，失败也清理临时文件。
- 合并邮箱测试配置的端口偏移和独立 polish 邮件地址；补齐 Service Worker 的 ESLint Response 全局声明。
- 增加真实 main → compute 多 Worker 原生冒烟：会话、Cookie 拒绝、同步、轮换、知识库路由、维护、回调验签与 D1 幂等。

## D1 迁移

- deploy 的 0001–0005 文件与合并后逐字节一致，SHA-256 回归锁定；新迁移仅 `0006_mobile_api.sql`，M10 无额外迁移。
- 编号无冲突，无需重新编号；未修改任何已上线迁移。
- 隔离本地 Wrangler 库先应用 0001–0005，再只追加 0006，再执行显示 `No migrations to apply`。
- 实际 `pnpm db:migrate` 在项目本地 D1 也只追加 0006；迁移回归保留账号、永久权益、订阅、登录和旧触发器。
- 未执行 remote 迁移；Owner 后续对当前 0005 生产库 apply 时仅追加 0006。

## DESIGN-GAP

- 原生请求的维护/业务处理归 compute；主入口强制禁止公共缓存并提供绑定缺失的 JSON 503。
- 保持旧 `format=png` 与 page=0 原生协议，实际文件采用合并后的单张 A4 JPEG；兼容旧 PNG/ZIP 分享。
- 本地测试入口直接向 compute D1 写入哈希令牌；测试回调用隔离 Authorization 和 TEST 事件，不调用真实身份/支付服务。
- 离线时暂停 Cookie 触发的延迟导入组件，在 online 事件恢复；无需预下载额外网络模块。
- 登录水合提交按独立 Promise 更新状态，保留 Server Action 回退；[React 并发 Action 批处理限制](https://react.dev/reference/react/useActionState#caveats)。
- 分享卡 OCR 按左右文字区域自上而下排序，避免 Vision 返回顺序打散完整建议；图片内容不改。
- 打印文档根节点继承与报告一致的 named page，避免空壳先生成默认纸张。
- 已上线迁移以固定文件名和内容哈希作为只追加基线，匹配 Wrangler 的文件名迁移记录机制。

## 验证

- 已通过 pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build。
- Web Vitest 全量：150 套、3795 通过、2 个既有环境限定跳过；包含路由、迁移、导出与离线回归。
- App Jest 全量：56 套、266 项通过（含新增 JPEG MIME 与分享失败清理用例）。
- fonts:check、i18n:check、licenses:check（1790 包）通过。
- Android `expo prebuild --platform android --no-install` 通过，未安装 Java、未做原生构建。
- pnpm test:e2e 全量退出 0：23 套、320 项通过；polish 46/46、完整导出 9/9（含新增两主题空白页回归）。
- pnpm cf:build 通过：main/compute/media raw 1.10/22.20/6.73MB，gzip 0.223/4.711/2.067MB，均满足原门槛。
- cf:multi:smoke 通过：23 项移动断言，冷请求 47.3ms、公共 RSC P75 ≤2.9ms；启动 `pnpm cf:smoke` 后，`pnpm test:cloudflare:e2e` 7/7 通过。

## 未完成/待验项

- 未部署、未 push、未提交证书/密钥/.env；.codex-runs 未改动。
- Android 原生构建、Android 模拟器/小组件/TalkBack 验收留待 Owner 安装 Java。
- 真实 Apple/Google/RevenueCat 沙盒、生产 Browser Rendering 与线上性能需 Owner 后续部署和外部凭证验收。
