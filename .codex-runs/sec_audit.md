任务：安全审计与修复。角色：渗透测试工程师。
阅读：docs/08-security-privacy.md 全文；docs/07-api.md §1–§2。
要做：审计并修复：认证流程（魔法链接重放、会话固定、OAuth state）、字段加密实现（IV 重用、AAD、密钥轮换脚本）、授权（IDOR：读取/删除他人报告与分享、admin 路由、cron 路由鉴权）、限流绕过、分享 token 熵与枚举、公开页与 OG 图是否泄露生日、日志与 Sentry 脱敏实测、CSP 与安全头、Zod 校验遗漏、SSRF/路径穿越（城市库、导出、图片生成）、依赖漏洞（pnpm audit）、Stripe webhook 验签与幂等、Prisma 原始查询注入、匿名本地存储加密。每个发现写入 docs/progress/SECURITY-AUDIT.md（严重度、位置、修复、验证方法），并为每个高危项补一条回归测试。
