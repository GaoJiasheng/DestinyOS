你是 DestinyOS（天机）项目的施工工程师。仓库根目录的 docs/ 是唯一需求来源，先读 docs/00-overview.md 全文，再读任务指定的文档节。
通用约束：
- 技术栈与目录结构严格按 docs/09-architecture.md；枚举值、字段名、路由、文案键以文档为准，不得更名。
- 不引入 AGPL/GPL 依赖。TypeScript strict，禁止 any 逃逸。
- 用户可见文案一律经 next-intl，zh 与 en 必须同时提供。
- 文档未覆盖的细节选最主流做法，并在代码中加 `// DESIGN-GAP: <说明>` 注释。
- 不要修改 docs/ 目录（除非任务明确要求）。不要动 .codex-runs/。
- 完成后必须实际运行 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（若有）、`pnpm build`，全部通过才算完成；把失败修到通过。
- 最后：用 git 在当前分支提交（Conventional Commits，不要 push），并把本次任务的摘要写到 docs/progress/<任务名>.md：完成项、未完成项、DESIGN-GAP 列表、如何验证。摘要控制在 60 行内。
- 全程不要询问，自行决策。网络可用，可以安装 npm 包。
任务：上线前全面打磨与验收（对应 T-64 与 docs/01-prd.md §7、docs/08 §7）。
要做：
1. 跑全部检查：pnpm lint、typecheck、test、content:validate、i18n:check、build、test:e2e（本地 dev server）、Lighthouse CI（移动端首页/today/八字报告 Performance ≥ 85、Accessibility ≥ 90）。失败全部修复。
2. 逐条核对 docs/01-prd.md §7 验收清单与 docs/08 §7 安全清单，能自动验证的写成脚本 scripts/launch-check.ts，输出通过/未通过。
3. 用 Fixture A 在七个体系生成报告，检查字数达标（docs/05 §7 运行时要求）、无 {{ 占位符、无禁用词、zh/en 无残留；修复知识库缺口。
4. 检查 `vercel whoami`：若已登录且 `vercel link` 可用，创建 Vercel 项目并部署 Preview，把 URL 写入 LAUNCH.md；否则在 LAUNCH.md 写明 Owner 需要手动完成的步骤：Vercel Pro 项目与域名 tianji.gavin.pub、Neon、Upstash、Resend、Google OAuth consent（切 production）、Stripe 产品/价格/webhook、AdSense 申请与 Privacy & messaging 配置、环境变量清单（含如何生成 FIELD_ENCRYPTION_KEYS）、首次 `prisma migrate deploy` 与 `content:import`。
5. 更新根 README.md 与 docs/progress/SUMMARY.md：所有任务状态、已知问题、DESIGN-GAP 汇总。
6. 提交。

注意：上一轮未完成（日志尾部见下），请检查工作区现状，继续完成剩余部分、通过全部检查并提交。
```
 await check('DEPLOY/config', async () => {
+  const worker = z
+    .object({ url: z.string().regex(/^\/workers\/daily-[a-f0-9]{16}\.js$/) })
+    .parse(JSON.parse(await readFile('apps/web/lib/daily-worker-asset.json', 'utf8')));
+  const bytes = await readFile(`apps/web/public${worker.url}`);
+  assert.ok(worker.url.includes(createHash('sha256').update(bytes).digest('hex').slice(0, 16)));
   const config = z
     .object({
       crons: z.array(z.object({ path: z.string(), schedule: z.string() })),
@@ -249,7 +281,7 @@
         files.has(resolve(`packages/content/dist/${system}.${locale}.json`)),
         `Missing deployed ${system}.${locale} knowledge`,
       );
-  return 'Workspace knowledge traced; app-root cron and migration-before-build configured';
+  return 'Workspace knowledge traced; hashed daily worker present; app-root cron and migration-before-build configured';
 });
 // DESIGN-GAP: Browser-dependent checklist items execute the real-app suites; a quick run never claims their evidence.
 const browserGates = [
diff --git a/scripts/perf-run.ts b/scripts/perf-run.ts
index f1496bd2e9bc679f0f5b926edc929a1bbcda029d..3b1209bfe0fb79ab94fac618c1ce9b283f0af67c
--- a/scripts/perf-run.ts
+++ b/scripts/perf-run.ts
@@ -11,6 +11,10 @@
     TEST_SERVICE_PORT_OFFSET: '2000',
     TEST_WEB_PORT: '38100',
     TEST_WEB_MODE: 'production',
+    // DESIGN-GAP: The production service harness requires its loopback mail preload even for anonymous Lighthouse pages; use isolated test credentials.
+    TEST_MAIL_URL: 'http://127.0.0.1:60081/mail',
+    RESEND_API_KEY: 're_test',
+    EMAIL_FROM: 'Tianji <noreply@example.com>',
     DATABASE_URL:
       'postgresql://postgres:postgres@127.0.0.1:57432/postgres?connection_limit=1&statement_cache_size=0',
     DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:57432/postgres',

ERROR: You’ve hit your usage limit. Visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Oct 10th, 2026 5:44 AM.
ERROR: You’ve hit your usage limit. Visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Oct 10th, 2026 5:44 AM.
2026-10-05T00:02:50.757845Z ERROR codex_core::session: failed to record rollout items: thread 01a10905-6cc2-7b00-ae40-b88c64f8d397 not found
tokens used
970,062
EXIT=1
```
