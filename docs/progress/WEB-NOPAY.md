# WEB-NOPAY · 网站暂不收款与 Cloudflare 费用熔断

## 完成项

- FEATURE_WEB_PAYMENTS 默认 false；pricing/billing 三语言介绍权益与 App 价格，App 开通按钮、商店下载、二维码、移动商店跳转与即将上架状态。
- 关闭支付时 Stripe API 404、Action 拒绝、页面不加载 Stripe 控件/SDK/脚本；Stripe secrets 非必需。保留已核验的 USD 2.99 月付 / USD 6.99 一次性产品脚本，取消年付。
- RevenueCat HMAC 验签、D1 event 幂等及用户租约保留；按 REST pro 同步永久、订阅、宽限、到期及退款撤销；登录用户可刷新，缺 key 跳过；App/Web 统一 User.id。
- WAF 脚本按 ref 创建/更新 gavin.pub 规则，不覆盖其他规则；动态请求 IP 60/10s、阻断 60s，排除静态路径；dry-run 无网络、无需令牌。未执行规则创建。
- CPU 限额 5000ms；保留每日 Cron，新增每小时账户计费月 GraphQL 请求/CPU 汇总，90% 开、80% 恢复、新周期恢复，缺令牌跳过。
- 持久 KV circuit/mode/state；Worker 在 OpenNext 与 DB 前返回三语言静态 503；PDF、追问、分享图均被拦截；保留后台/登录/Cron/RevenueCat 恢复入口。
- Email Service 告警按周期/收件人去重，失败重试；admin/config 可手动开、关及恢复自动，有 D1 审计。
- 延迟知识校验器加载，避免 workerd 禁止 AJV 动态编译导致配置恢复页 500；补充真实 KV/workerd 后台操作验收。
- 更新 docs/11、App 规划 §6、LAUNCH、MORNING、env 示例；未改 .codex-runs，保留任务开始前的未提交修改。

## 未完成项

- 施工项无遗留；生产 WAF、secrets、部署、商店 URL/商品、RevenueCat 配置与真实发信由 Owner 执行，命令见 LAUNCH.md。
- 本地 CPU 样本不等同生产 workerd；Owner 发布后按真实慢路由 CPU P99 复核限额。

## DESIGN-GAP

- iPad 桌面模式以 Mac UA + 多点触控识别；其他设备显示双商店选项，缺 URL 不猜测地址。
- RevenueCat 撤销永久权益时只保留历史 Stripe 自有 lifetime；支付关闭时删除账户不调用 Stripe，旧续费由 Owner 在 Stripe 管理。
- 计费周年日用 CF_BILLING_CYCLE_DAY（UTC，默认 1，短月份取末日）；账户额度共享，GraphQL 按日切片聚合所有脚本，微秒转毫秒。
- admin 三态 override 与自动状态分离；恢复入口白名单固定为 admin/auth/health/Cron/RevenueCat，其他动态路由全部拦截。
- WAF 必需 cf.colo.id，按边缘位置计数；套餐需支持指定阻断参数。Analytics/KV 有延迟，维护请求仍可能计费，不是账单硬封顶。
- 知识库 Action 按需加载，确保后台配置恢复不触发不相关的 AJV 编译。
- CPU 基准用实际 OG handler、完整 PNG body 与 process.cpuUsage；替换 auth/quota/分享数据/翻译上下文，保留真实字体、签名和渲染。

## 如何验证

- 必需检查：pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build 均已实际通过。
- 单测：3673 通过；原有外部付费用例与默认不运行的 CPU 基准共 2 项跳过；移动端 Jest 4 通过。
- 无支付页面 E2E：zh/zh-TW/en × desktop/mobile，6 通过；开关开启后的 Stripe M4（月付/永久/取消/到期）E2E 6 通过。
- Cloudflare OpenNext 构建（gzip 6069678/8000000 字节）、真实 KV/workerd E2E 5 项（含后台手动恢复）、i18n:check、fonts:check 均通过；WAF 仅运行 mock API 单测。
- CPU：RUN_CF_CPU_BENCHMARK=1 pnpm exec vitest run apps/web/test/route-cpu.test.ts；三个路由各 100 样本，结果 /tmp/destinyos-route-cpu.json。
- story P99 742.541ms，landscape 340.708ms，daily 367.924ms；ceil(3×742.541)=2228ms，取 max(5000,2228)=5000ms。
- Owner 命令、secret 权限、计费周期与商店/RevenueCat 配置见 LAUNCH.md；本次未部署、未调用真实支付/商店、未 push。
