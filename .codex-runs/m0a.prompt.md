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
任务：M0-A = docs/13-delivery-plan.md 中的 T-01、T-02、T-03。
阅读：docs/09-architecture.md 全文；docs/03-visual-design.md §1、§2.1、§4、§6；docs/02-information-architecture.md §1–§2；docs/12-i18n-and-copy.md 全文；docs/00-overview.md。
要做：
1. T-01 初始化 monorepo：pnpm workspaces + Turborepo；apps/web（Next.js 15 App Router、React 19、TS strict、Tailwind 4、shadcn/ui 初始化）；packages/shared、engine、interpret、content、config 的空壳（各含 package.json、tsconfig、一个导出）；@tianji/shared 里实现 brand.ts（nameZh 天机、nameEn DestinyOS、domain tianji.gavin.pub）与 enums.ts（System、Gender、Locale、Plan 等按文档）；ESLint 9 flat + Prettier；Vitest 配置；.env.example（docs/09 §4 全部变量带注释）；docker-compose.yml（postgres:16 + redis:7）；根 README.md 写本地开发步骤。
2. T-02 设计 token 与全局框架：Tailwind @theme 定义 docs/03 §1 的全部 token（基础色、east/west/vedic 主题通过 data-theme 切换）；字体先用 @fontsource 的 noto-serif-sc、cinzel、cormorant-garamond、inter 与 lxgw-wenkai-webfont（npm 包），不做子集；全局布局：桌面顶部导航 + 移动底部 Tab（5 项按 docs/02 §2.1）、页脚（docs/02 §2.2）、Toast、错误边界页、首访免责声明弹层（文案按 docs/08 §6.5，localStorage 记忆）；CSS 星空背景层（docs/03 §2.1 第 1、2 层，不用 three）；一个 /[locale]/dev/tokens 页面展示所有 token 与按钮/卡片/chip 在三个主题下的样子。
3. T-03 i18n：next-intl 路由中间件（/zh、/en，默认 zh，Accept-Language 首访重定向，cookie 记忆）；messages/zh.json 与 en.json 包含 docs/12 §3 全部键以及你新增页面用到的键；LocaleSwitch 组件；scripts/i18n-check.ts 比对 zh/en 键完整性与 ICU 语法，接入 `pnpm i18n:check`。
4. 首页 /[locale] 先做一个占位版本：品牌字（来自 @tianji/shared/brand）、slogan（brand.tagline）、两个按钮，使用 token 与星空背景。
验收：pnpm install && pnpm lint && pnpm typecheck && pnpm i18n:check && pnpm build 全部通过；pnpm dev 能打开 /zh 与 /en 与 /zh/dev/tokens。
