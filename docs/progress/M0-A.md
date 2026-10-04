# M0-A：T-01 / T-02 / T-03

状态：M0-A 收尾完成；2026-10-04 指定检查与 curl 验证全部通过，已在当前分支提交，未 push。

## 完成项
- pnpm 9 workspaces、Turborepo 2、Next.js 15 / React 19 / TS strict / Tailwind 4 骨架。
- 五个包的 package.json、tsconfig、导出；共享品牌与文档模型枚举。
- ESLint 9 flat、Prettier、Vitest、CI、全部环境变量、Postgres 16 / Redis 7、README。
- shadcn 配置与 Radix 基础组件；设计 token、三主题展示页、全量 npm 字体引用。
- 桌面导航、移动五 Tab、体系选择与快速占卜面板、页脚、Toast、错误/404 页面。
- 必须点击确认的首访完整双语免责声明、localStorage 记忆、CSS 200+100 星点。
- next-intl 3 路由、默认 zh、语言协商与 Cookie 配置、保留路径的 LocaleSwitch。
- 127 个双语键（含 §3 全部 37 键），原始键保持不变；ICU 校验脚本与回归测试。
- /zh、/en 品牌占位首页；/zh/dev/tokens 和 /en/dev/tokens。
- Playwright 双语桌面/移动验证、截图与 axe 检查配置。
- 安装 pnpm 9.15.9，完成依赖安装并生成 pnpm-lock.yaml。
- 修复 Prettier 3 检出的 globals.css 格式；整理 Next.js 自动生成的 tsconfig 格式。
- 补全 .gitignore：含 .env.local 与 .codex-runs/*.log，保留已有产物忽略项。
- 保留 Turborepo 自动生成的 AGENTS.md 指引；按指定 Conventional Commit 提交。

## 未完成项 / 范围
- 本次指定收尾事项无未完成项，原网络与 Git 沙箱阻塞已解除。
- 本轮只运行指定命令和 curl；Playwright 截图与 Lighthouse Accessibility ≥ 90 未执行。
- 数据库、认证、广告 CMP、引擎、知识库、完整业务/法律页面属于后续任务。

## DESIGN-GAP
- 文档消息 timeUnknown 与 .help 同名冲突：原始键保留，运行时父消息映射 __value。
- 未登录前主题锁与免责声明确认使用本机存储；用户设置持久化等待认证。
- 未命名的四化、元素、相位、布局/品牌字距值增加语义 token。
- 吠陀 glow 沿用其他主题 35% 透明度；金色/藏红按钮用深色字满足对比度。
- PNG 纹理未提供，临时采用 CSS 程序纹理。
- 后续导航目的地显示建设中占位；未知路由返回 404。
- 根布局失败时用独立 next-intl Provider，从 URL 恢复语言。
- 包空壳导出 readiness，不伪造排盘或解读能力。
- 本次收尾无新增 DESIGN-GAP。

## 如何验证 / 实际结果
- 环境：Node.js 25.8.2、pnpm 9.15.9（npm install --global pnpm@9.15.9）。
- pnpm install：通过；下载超时后降低并发重试，261 个包安装完成。
- pnpm lint：通过（ESLint 9 与 Prettier 3，零错误）。
- pnpm typecheck：通过（六个 workspace 包与 scripts，strict 继承配置保持启用）。
- pnpm test：通过（3 个文件，15 条测试）。
- pnpm i18n:check：通过（zh/en 键完整性与 ICU 语法）。
- pnpm build：通过（6 个任务成功，Next.js 15.5.27，7 个静态页面生成成功）。
- pnpm dev 后 curl /zh、/en、/zh/dev/tokens：均 HTTP 200 且正文包含「天机」。
- dev server 已关闭；关闭后 curl 连接失败，HTTP 000。
- 已安装包的许可证元数据扫描：无 GPL/AGPL 命中。
- 提交命令：git commit -m "feat: scaffold monorepo, design tokens and i18n (M0-A)"。
- 提交包含本摘要与锁文件，排除 .codex-runs/*.log，未修改 .codex-runs/ 内容，未执行 push。
