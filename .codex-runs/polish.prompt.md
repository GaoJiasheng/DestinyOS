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
任务：上线前打磨（视觉与内容质量）。
阅读：docs/03-visual-design.md 全文；docs/02-information-architecture.md §3；docs/05-interpretation-engine.md §7–§8；docs/prototypes/home-and-bazi.html（视觉对照）。
要做：
1. 启动本地完整环境（docker compose 的 postgres/redis 或测试替身），用 Playwright 对以下页面在 375px 与 1280px、zh 与 en 各截图：首页、出生表单两步、七个体系的报告/结果页（用 Fixture A；占卜类用固定 seed）、每日运势、分享弹层与公开页、我的、设置、定价、学习百科的一张牌与一卦、登录页。截图存 test-results/polish/。
2. 逐张对照 docs/03 与原型检查并修复：token 使用是否一致、主题是否按路由切换、字体是否生效（文楷大字干支/卦名、Cinzel 英文标题）、对比度、移动端是否有横向溢出、触控目标 ≥44px、入场动效与 reduced-motion 降级、广告容器占位、空/加载/错误/无时辰状态是否都渲染正确。
3. 报告内容质量：对 Fixture A 七体系与 B、D、E 三个档案生成 zh/en 报告，检查：每章非空、结论句存在、术语 chip 有弹层、依据标签可点击高亮命盘、无 {{ 占位、无禁用词、过渡词不重复、zh/en 无语言残留、字数达标；发现知识库缺口直接补 KU 并通过 content:validate。
4. 交互走查并修复：塔罗仪式全流程、六爻摇卦、梅花报数、奇门起局、紫微盘点击三方四正、占星轮盘点击联动与宫位制切换、日期切换手势、分享下载、语言切换保持路径、删除账户流程。
5. 把发现与修复清单写入 docs/progress/POLISH.md（含截图路径），提交。
