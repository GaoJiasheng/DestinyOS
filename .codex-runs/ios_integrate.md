任务：前后端合并（iOS 上线前置）。
现状：main 分支含 App（apps/mobile）与手机端后端接口 /api/v1/mobile/*（M09：令牌认证、同步、知识库增量包、RevenueCat webhook 等）；deploy 分支（本地分支 `deploy`，线上运行版本）含三 Worker 架构（destinyos 主入口 / destinyos-compute / destinyos-media）、性能优化、导出重做（A4 长图 + 紧凑 PDF）、美术位图、Service Worker 修复。两边各有十余个提交未互相包含。
要做：
1. 在 main 上 `git merge deploy`，解决冲突时保留双方全部功能；手机端接口必须运行在 destinyos-compute Worker 中（与 Auth/D1/KV 同处），主入口对 /api/v1/mobile/* 不做公共缓存、直接转发给 compute；RevenueCat webhook 同理。
2. D1 迁移：检查 main 上 M09/M10 新增的迁移文件与 deploy 已在线上执行到的迁移（线上已执行到 0005_lifetime_billing.sql）是否编号冲突，若冲突重新编号，确保 `wrangler d1 migrations apply destinyos --remote` 只会追加执行新迁移；只做本地验证，不执行 remote。
3. 全量检查：pnpm install、lint、typecheck、test、build、test:e2e（主流程、导出、polish 抽查）、cf:build（三个 Worker 体积门槛）、cf:multi:smoke、test:cloudflare:e2e，外加 apps/mobile 的 Jest 全量；新增一组针对 /api/v1/mobile/* 经主入口转发到 compute 的多 Worker 冒烟断言。
4. 写 docs/progress/IOS-INTEGRATE.md；提交（merge commit + 修复提交）。不部署、不 push。
