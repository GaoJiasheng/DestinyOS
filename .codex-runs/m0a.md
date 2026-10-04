任务：M0-A = docs/13-delivery-plan.md 中的 T-01、T-02、T-03。
阅读：docs/09-architecture.md 全文；docs/03-visual-design.md §1、§2.1、§4、§6；docs/02-information-architecture.md §1–§2；docs/12-i18n-and-copy.md 全文；docs/00-overview.md。
要做：
1. T-01 初始化 monorepo：pnpm workspaces + Turborepo；apps/web（Next.js 15 App Router、React 19、TS strict、Tailwind 4、shadcn/ui 初始化）；packages/shared、engine、interpret、content、config 的空壳（各含 package.json、tsconfig、一个导出）；@tianji/shared 里实现 brand.ts（nameZh 天机、nameEn DestinyOS、domain tianji.gavin.pub）与 enums.ts（System、Gender、Locale、Plan 等按文档）；ESLint 9 flat + Prettier；Vitest 配置；.env.example（docs/09 §4 全部变量带注释）；docker-compose.yml（postgres:16 + redis:7）；根 README.md 写本地开发步骤。
2. T-02 设计 token 与全局框架：Tailwind @theme 定义 docs/03 §1 的全部 token（基础色、east/west/vedic 主题通过 data-theme 切换）；字体先用 @fontsource 的 noto-serif-sc、cinzel、cormorant-garamond、inter 与 lxgw-wenkai-webfont（npm 包），不做子集；全局布局：桌面顶部导航 + 移动底部 Tab（5 项按 docs/02 §2.1）、页脚（docs/02 §2.2）、Toast、错误边界页、首访免责声明弹层（文案按 docs/08 §6.5，localStorage 记忆）；CSS 星空背景层（docs/03 §2.1 第 1、2 层，不用 three）；一个 /[locale]/dev/tokens 页面展示所有 token 与按钮/卡片/chip 在三个主题下的样子。
3. T-03 i18n：next-intl 路由中间件（/zh、/en，默认 zh，Accept-Language 首访重定向，cookie 记忆）；messages/zh.json 与 en.json 包含 docs/12 §3 全部键以及你新增页面用到的键；LocaleSwitch 组件；scripts/i18n-check.ts 比对 zh/en 键完整性与 ICU 语法，接入 `pnpm i18n:check`。
4. 首页 /[locale] 先做一个占位版本：品牌字（来自 @tianji/shared/brand）、slogan（brand.tagline）、两个按钮，使用 token 与星空背景。
验收：pnpm install && pnpm lint && pnpm typecheck && pnpm i18n:check && pnpm build 全部通过；pnpm dev 能打开 /zh 与 /en 与 /zh/dev/tokens。
