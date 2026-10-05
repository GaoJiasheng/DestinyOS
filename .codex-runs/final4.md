任务：上线前全面打磨与验收（对应 T-64 与 docs/01-prd.md §7、docs/08 §7）。
要做：
1. 跑全部检查：pnpm lint、typecheck、test、content:validate、i18n:check、build、test:e2e（本地 dev server）、Lighthouse CI（移动端首页/today/八字报告 Performance ≥ 85、Accessibility ≥ 90）。失败全部修复。
2. 逐条核对 docs/01-prd.md §7 验收清单与 docs/08 §7 安全清单，能自动验证的写成脚本 scripts/launch-check.ts，输出通过/未通过。
3. 用 Fixture A 在七个体系生成报告，检查字数达标（docs/05 §7 运行时要求）、无 {{ 占位符、无禁用词、zh/en 无残留；修复知识库缺口。
4. 检查 `vercel whoami`：若已登录且 `vercel link` 可用，创建 Vercel 项目并部署 Preview，把 URL 写入 LAUNCH.md；否则在 LAUNCH.md 写明 Owner 需要手动完成的步骤：Vercel Pro 项目与域名 tianji.gavin.pub、Neon、Upstash、Resend、Google OAuth consent（切 production）、Stripe 产品/价格/webhook、AdSense 申请与 Privacy & messaging 配置、环境变量清单（含如何生成 FIELD_ENCRYPTION_KEYS）、首次 `prisma migrate deploy` 与 `content:import`。
5. 更新根 README.md 与 docs/progress/SUMMARY.md：所有任务状态、已知问题、DESIGN-GAP 汇总。
6. 提交。
7. 额外：运行 `pnpm cf:build`（Cloudflare 构建）确保通过；把 MORNING.md 写到仓库根：给 Owner 的「今早部署清单」——按 Cloudflare 优先、Vercel 备选，逐步列出要执行的命令（wrangler login、secret put 每个变量、R2/Browser Rendering 开通、域名绑定、Neon/Upstash/Resend/Google OAuth/Stripe/AdSense 的创建顺序与回填位置）、每步预计时间、每步的验证方法、以及本轮所有新功能的一句话说明与已知问题。
