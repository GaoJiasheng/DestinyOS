# 天机 · DestinyOS

中英双语命理平台，域名 `tianji.gavin.pub`。`docs/` 是唯一需求来源。
当前里程碑 **M0-A（T-01 / T-02 / T-03）**：工程骨架、设计 token、全局框架和国际化。

## 本地开发

需要 Node.js 20.9+（建议 Node.js 22 LTS）、pnpm 9 和 Docker Compose。

```bash
npm install -g pnpm@9.15.9
pnpm install
cp .env.example apps/web/.env.local
docker compose up -d
pnpm dev
```

Next.js 从 `apps/web` 读取 `.env.local`。M0-A 的页面不依赖数据库、OAuth、Stripe 或广告密钥；
这些服务的变量保留在 `.env.example`，按后续任务配置。Prisma 迁移和知识库编译尚未实现。

访问：

- http://localhost:3000/zh — 中文首页
- http://localhost:3000/en — English home
- http://localhost:3000/zh/dev/tokens — 所有 token 和三个主题的组件
- http://localhost:3000/en/dev/tokens — English token gallery

无语言前缀的地址根据 `NEXT_LOCALE` Cookie、`Accept-Language`、默认 `zh` 的顺序跳转。
首访须明确点击「我知道了」；后续访问使用 localStorage 保存的确认。
导航中后续里程碑的页面会清楚展示建设中状态。

## 工程命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm i18n:check
pnpm build
pnpm --filter @tianji/web start
```

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

E2E 覆盖首访确认、语言协商与切换、主题规则、token 弹层、Toast、减少动效、无障碍检查；
运行后生成中文/英文、桌面/移动截图到 `test-results/`（不入 Git）。
手动 Lighthouse 验证首页 Accessibility ≥ 90：生产构建后启动页面，在 DevTools 中运行移动审计。

`pnpm format` 统一格式。`pnpm lint` 同时检查 ESLint 和 Prettier。
文案源文件保留设计稿的完整点分键；加载时适配为 next-intl 命名空间，解决同名消息与子键冲突。
禁止 `any`、`@ts-ignore` 和 `@ts-nocheck`。引擎与解读包保持纯 TypeScript 空壳，无服务端 IO。
字体通过 npm 包全量自托管，字体子集和真实 3D 星空留给 T-44 与 T-38。

## 目录

- `apps/web`：Next.js 15 App Router / React 19 / Tailwind 4 / shadcn 风格组件 / next-intl 3
- `packages/shared`：唯一品牌配置、模型枚举
- `packages/engine`、`interpret`、`content`：后续领域任务的空壳
- `packages/config`：共享 TypeScript strict 和 ESLint 9 flat 配置
- `scripts`：双语键与 ICU 校验
- `docs/progress/M0-A.md`：本次交付与验收记录
