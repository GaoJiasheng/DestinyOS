# merge-perf-web-art-assets

## 完成项

- 在 deploy 顺序合并 wt/perf_web（14e38c7）、wt/art_assets（cf1500f），各一个 merge commit。
- Wrangler 同时保留 deploy 的 mail.gavin.pub 邮件配置和性能观测、版本化缓存绑定。
- 奇门页保留静态缓存、DeferredQimen 懒加载及 SystemArt 美术横幅。
- 首页保留客户端今日一瞥、延迟引擎/星空与银河、水墨、体系插画。
- OpenNext 素材处理同时保留公共 HTML/RSC 缓存和分享图、美术资源。
- 五个出生体系的新静态落地页补回美术横幅；共享 shell 与塔罗局部 Provider 补齐 art 文案。
- 插画中英回归断言及浏览器翻译错误检查，Cloudflare 缓存页面同时检查插画与奇门懒加载。
- 美术预算浏览器测试由 production polish 套件执行，避免进入默认开发服务套件。
- 修复已有 WAF Zone ID 覆盖值解析，保留 deploy 的 10 秒窗口，排除新增 /art/ 静态路径。
- 更新美术、占星、紫微、M5 塔罗基线；首页与八字重新生成后内容一致。
- cf:smoke 正常 SIGINT/SIGTERM 停机返回成功，保留意外启动/运行退出的失败状态。

## 未完成项

- 无。本次合并、修复、视觉基线与全部指定验证已完成。
- 未部署、未 push。

## DESIGN-GAP

- art alt 文案属于共享 shell：首访弹窗、错误态位于功能 Provider 之外。
- 塔罗仅序列化 tarot/art 命名空间；浏览器测试同时拒绝插画翻译错误。
- art.spec.ts 依赖生产 PWA，沿用独立 polish 配置和服务。
- WAF 保留 deploy 已有 Zone 套餐对应的 10 秒阻断窗口，脚本未实际执行。
- cf:smoke 是常驻本地服务器：主动停机返回 0，意外退出仍返回原始失败码。
- 分支已有 DESIGN-GAP 沿用，详情见 PERF-WEB.md 与 ART.md。

## 如何验证

- 已通过 pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build。
- 单测：3682 passed / 2 skipped，Mobile 4 passed；覆盖率各项超过 90%。
- 已通过 i18n:check、字体覆盖、首屏 JS/字体/图片预算及知识库内容审计。
- pnpm test:polish --update-snapshots：46 passed，更新 13 张受影响基线。
- 首页 8、八字 4、紫微 8、占星/吠陀 16、M5 4、插画/公开页 16 项不更新基线复核通过。
- 部分截图套件用 /tmp 配置复用本次 production 构建及隔离服务；常规配置仍可独立复现。
- pnpm cf:build 通过：Worker raw 26,952,115B；gzip 6,170,592B / 8,000,000B。
- pnpm db:migrate 本地迁移通过；pnpm cf:smoke 启动成功，主动 SIGINT 停机退出码 0。
- 停机修复后再次通过 lint、typecheck 与六项 Cloudflare 冒烟测试。
- pnpm test:cloudflare:e2e：6 passed，含缓存 HIT、RSC/会话隔离、插画与懒加载、D1/KV、OG、费用熔断。
- 视觉回归使用 --update-snapshots 更新后再不带该参数复核。
