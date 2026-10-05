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
任务：引擎独立交叉验证（只改 packages/engine 与其测试、必要时 packages/shared；不改前端）。
阅读：docs/04-engine-overview.md §4、§9；docs/systems/*.md 的「核验与测试」节。
要做：用 Python 虚拟环境安装独立参考库做对照（仅用于本地测试脚本，不进入发布产物、不加入运行时依赖）：sxtwl（八字四柱、节气、农历）、pyswisseph（行星黄经、ASC/MC、Placidus/Whole Sign 宫头、Lahiri ayanamsa；AGPL 仅本地对照）、kinqimen（奇门）、以及用 iztro 之外的紫微参考（若 pip 有 py-iztro 或其他库则用，否则跳过并说明）。生成 300 个随机合法出生档案（覆盖 1900–2030、南北半球、东西经、DST、晚子时、无时辰）与 60 个起卦/起局时刻的参考结果 JSON（存 packages/engine/test/fixtures/xval/），编写 Vitest 对照测试，容差按文档。对每个差异判断是流派差异（在文档流派表范围内，记录到 docs/progress/XVAL.md 并在 schoolUsed 标注）还是 bug（修复）。重点核查：立春/节气边界、真太阳时跨日、西经夏令时、Placidus 高纬、Nakshatra 边界、Dasha 起运比例、拆补法三元边界。
