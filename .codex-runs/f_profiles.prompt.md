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
任务：多档案与合盘（docs/14 B-01、B-02）。
要做：
1. 多档案：BirthProfile 增加 label、isDefault、relation（self/partner/family/friend/other）；去掉每用户单档案约束；档案切换器（导航头像菜单与 /me/profiles 管理页：新增/编辑/删除/设默认，上限免费 3 个、会员 20 个）；所有体系与每日运势按当前选中档案计算；Reading 关联 profileId 已有；分享与导出沿用。
2. 合盘 system `synastry`：选择两个档案 → 八字合婚（日柱天干合/冲、日支六合/六冲、年柱生肖关系、五行互补度、配偶星互看、十神互动）、紫微合盘（双方命宫与夫妻宫主星互看、互入对方三方四正的四化）、西方 Synastry（行星两两相位表、对方行星落我宫、金火日月互动）、吠陀 Ashtakoot 36 Guna（Varna/Vashya/Tara/Yoni/Graha Maitri/Gana/Bhakoot/Nadi 完整表）；输出 chart schema；知识库约 250 条 KU（zh/en）；报告页：双盘并排/叠加可视化（合盘轮盘叠加、八字双四柱对照表、36 分仪表）、章节：整体契合、沟通、感情、价值观与金钱、冲突模式、长期建议；分享卡模板「合盘卡」。
3. 文档：docs/systems/synastry.md；测试：引擎单测（Ashtakoot 手算用例 3 组）、E2E 一条。
